import { readFile, writeFile } from "fs/promises";
import { join, dirname, parse } from "path";
import { loadAsync } from "jszip";
import JSZip = require("jszip");

type DefoldGraph = DefoldGraphNode[];

interface DefoldGraphNode {
    path: string;
    hexDigest: string;
    nodeType: DefoldGraphNodeType|undefined;
    isInMainBundle: boolean|undefined;
    children: string[];
}

enum DefoldGraphNodeType {
    CollectionProxy = "CollectionProxy",
    ExcludedCollectionProxy = "ExcludedCollectionProxy"
}

class DefoldResourceAchive {
    public name: string;
    public assets: string[];

    constructor(name: string, assets: string[]|undefined) {
        if (!name) {
            throw new Error("Name cannot be empty for defold resource achive.");
        }
        this.name = name;
        this.assets = assets ? assets : new Array<string>();
    } 
}
type DefoldSplitDeclaration = Array<DefoldResourceAchive>;

function validateSplitOptions(options: SplitOptions): void {
    if (options.method === SplitMethod.ByGroups &&
        (options.groups === null || options.groups!.length === 0)) {
        throw new Error("Split method is ByGroups, but there are no any groups defined.");
    }
    if (options.method === SplitMethod.ByGroups) {
        if (options.groups === null || options.groups!.length === 0) {
            throw new Error("Split method is ByGroups, but there are no any groups defined.");
        }
        if (options.groups.some((group) => !group.name) || new Set(options.groups.map((group) => group.name)).size != options.groups.length) {
            throw new Error("Not allowed to use same names in groups or use empty name.");
        }
    }
}

function splitByCollections(graph: DefoldGraph): DefoldSplitDeclaration {
    const declaration = new Array<DefoldResourceAchive>() as DefoldSplitDeclaration;
    const excludeCollectionNodes = findNodesByType(graph, DefoldGraphNodeType.ExcludedCollectionProxy);
    for (const collectionNode of excludeCollectionNodes) {
        const collectionChild = findNodeByPath(graph, collectionNode.children[0]);
        if (!collectionChild) {
            throw new Error("One of graph nodes with excludeCollection type doesn't contains child.");
        }
        const archiveName = parse(collectionChild.path).name;
        const archiveAssets = findChildrenForNodeRecursive(graph, collectionNode).map((node) => node.hexDigest);
        declaration.push(new DefoldResourceAchive(archiveName, archiveAssets));
    }
    return declaration;
}

function splitByGroups(graph: DefoldGraph, groups: Array<SplitGroup>): DefoldSplitDeclaration {
    const declaration = new Array<DefoldResourceAchive>() as DefoldSplitDeclaration;
    const archives = new Map<string, DefoldResourceAchive>();
    const excludeCollectionNodes = findNodesByType(graph, DefoldGraphNodeType.ExcludedCollectionProxy);
    for (const collectionNode of excludeCollectionNodes) {
        const collectionChild = findNodeByPath(graph, collectionNode.children[0]);
        if (!collectionChild) {
            throw new Error("One of graph nodes with excludeCollection type doesn't contains child.");
        }
        const collectionName = parse(collectionChild.path).name;
        const group = groups.find((group) => group.collectionNames.includes(collectionName));
        if (!group) {
            continue;
        }
        if (!archives.has(group.name)) {
            const archive = new DefoldResourceAchive(group.name, new Array<string>());
            archives.set(group.name, archive);
            declaration.push(archive);
        }
        const archiveAssets = findChildrenForNodeRecursive(graph, collectionNode).map((node) => node.hexDigest);
        archives.get(group.name)!.assets.push(...archiveAssets);
    }
    return declaration;
}

function findNodesByType(graph: DefoldGraph, type: DefoldGraphNodeType): Array<DefoldGraphNode> {
    return graph.filter((node) => node.nodeType == type);
}

function findNodeByPath(graph: DefoldGraph, path: string): DefoldGraphNode|undefined {
    return graph.find((node) => node.path === path);
}

function findChildrenForNodeRecursive(graph: DefoldGraph, node: DefoldGraphNode): Array<DefoldGraphNode> {
    const children = graph.filter((child) => node.children.includes(child.path));
    for (const child of children) {
        const subChildren = findChildrenForNodeRecursive(graph, child);
        for (const subChild of subChildren) {
            if (children.indexOf(subChild) === -1) {
                children.push(subChild);
            }
        }
    }
    return children;
}

export enum SplitMethod {
    ByCollections,
    ByGroups
}

export class SplitGroup {
    public name: string;
    public collectionNames: string[];

    constructor(name: string, collectionNames: string[]) {
        this.name = name;
        this.collectionNames = collectionNames;
    }
}

export class SplitOptions {
    public method: SplitMethod = SplitMethod.ByCollections;
    public groups: SplitGroup[]|null = null;
    public output: string|null = null;

    static byCollections(output: string|null = null): SplitOptions {
        const options = new SplitOptions();
        options.method = SplitMethod.ByCollections;
        options.output = output;
        return options;
    }

    static byGroups(groups: SplitGroup[], output: string|null = null): SplitOptions {
        const options = new SplitOptions();
        options.method = SplitMethod.ByGroups;
        options.groups = groups;
        options.output = output;
        return options;
    }
}

export async function split(pathToGraph: string, pathToArchive: string, options: SplitOptions): Promise<void> {
    validateSplitOptions(options);

    const graphContent = await readFile(pathToGraph, "utf-8");
    const graph = JSON.parse(graphContent) as DefoldGraph;

    for (const node of graph) {
        node.isInMainBundle = node.isInMainBundle || node.isInMainBundle === undefined;
    }

    let splitDeclaration: DefoldSplitDeclaration;
    switch (options.method) {
    case SplitMethod.ByGroups:
        splitDeclaration = splitByGroups(graph, options.groups!);
        break;
    case SplitMethod.ByCollections:
    default:
        splitDeclaration = splitByCollections(graph);
        break;
    }

    const sourceZipBuffer = await readFile(pathToArchive);
    const sourceZip = await loadAsync(sourceZipBuffer);
    const sourceManifestFile = Object.keys(sourceZip.files).find((key) => key.endsWith(".dmanifest"));

    const outputPath = options.output ? options.output : dirname(pathToArchive);
    for (const archive of splitDeclaration) {
        const zip = new JSZip();
        for (const asset of archive.assets) {
            const sourceAsset = await sourceZip.file(asset)!.async("nodebuffer");
            zip.file(asset, sourceAsset);
        }
        if (sourceManifestFile) {
            const sourceManifest = await sourceZip.file(sourceManifestFile)!.async("nodebuffer");
            zip.file(sourceManifestFile, sourceManifest);
        }
        const zipPath = join(outputPath, `${archive.name}.zip`);
        const zipBuffer = await zip.generateAsync({
            type: "nodebuffer"
        });
        await writeFile(zipPath, zipBuffer);
    }
}