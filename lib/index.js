"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.split = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const jszip_1 = require("jszip");
const JSZip = require("jszip");
var DefoldGraphNodeType;
(function (DefoldGraphNodeType) {
    DefoldGraphNodeType["CollectionProxy"] = "CollectionProxy";
    DefoldGraphNodeType["ExcludedCollectionProxy"] = "ExcludedCollectionProxy";
})(DefoldGraphNodeType || (DefoldGraphNodeType = {}));
var SplitMethod;
(function (SplitMethod) {
    SplitMethod[SplitMethod["ByCollections"] = 0] = "ByCollections";
    SplitMethod[SplitMethod["ByGroups"] = 1] = "ByGroups";
})(SplitMethod || (SplitMethod = {}));
class SplitGroup {
    constructor(name, collectionNames) {
        this.name = name;
        this.collectionNames = collectionNames;
    }
}
class SplitOptions {
    constructor() {
        this.method = SplitMethod.ByCollections;
        this.groups = null;
        this.output = null;
    }
    static byCollections(output = null) {
        const options = new SplitOptions();
        options.method = SplitMethod.ByCollections;
        options.output = output;
        return options;
    }
    static byGroups(groups, output = null) {
        const options = new SplitOptions();
        options.method = SplitMethod.ByGroups;
        options.groups = groups;
        options.output = output;
        return options;
    }
}
class DefoldResourceAchive {
    constructor(name, assets) {
        if (!name) {
            throw new Error("Name cannot be empty for defold resource achive.");
        }
        this.name = name;
        this.assets = assets ? assets : new Array();
    }
}
function split(pathToGraph, pathToArchive, options) {
    return __awaiter(this, void 0, void 0, function* () {
        validateSplitOptions(options);
        const graphContent = yield (0, promises_1.readFile)(pathToGraph, "utf-8");
        const graph = JSON.parse(graphContent);
        for (const node of graph) {
            node.isInMainBundle = node.isInMainBundle || node.isInMainBundle === undefined;
        }
        let splitDeclaration;
        switch (options.method) {
            case SplitMethod.ByGroups:
                splitDeclaration = splitByGroups(graph, options.groups);
                break;
            case SplitMethod.ByCollections:
            default:
                splitDeclaration = splitByCollections(graph);
                break;
        }
        const sourceZipBuffer = yield (0, promises_1.readFile)(pathToArchive);
        const sourceZip = yield (0, jszip_1.loadAsync)(sourceZipBuffer);
        const sourceManifestFile = Object.keys(sourceZip.files).find((key) => key.endsWith(".dmanifest"));
        const outputPath = options.output ? options.output : (0, path_1.dirname)(pathToArchive);
        for (const archive of splitDeclaration) {
            const zip = new JSZip();
            for (const asset of archive.assets) {
                const sourceAsset = yield sourceZip.file(asset).async("nodebuffer");
                zip.file(asset, sourceAsset);
            }
            if (sourceManifestFile) {
                const sourceManifest = yield sourceZip.file(sourceManifestFile).async("nodebuffer");
                zip.file(sourceManifestFile, sourceManifest);
            }
            const zipPath = (0, path_1.join)(outputPath, `${archive.name}.zip`);
            const zipBuffer = yield zip.generateAsync({
                type: "nodebuffer"
            });
            yield (0, promises_1.writeFile)(zipPath, zipBuffer);
        }
    });
}
exports.split = split;
function validateSplitOptions(options) {
    if (options.method === SplitMethod.ByGroups &&
        (options.groups === null || options.groups.length === 0)) {
        throw new Error("Split method is ByGroups, but there are no any groups defined.");
    }
    if (options.method === SplitMethod.ByGroups) {
        if (options.groups === null || options.groups.length === 0) {
            throw new Error("Split method is ByGroups, but there are no any groups defined.");
        }
        if (options.groups.some((group) => !group.name) || new Set(options.groups.map((group) => group.name)).size != options.groups.length) {
            throw new Error("Not allowed to use same names in groups or use empty name.");
        }
    }
}
function splitByCollections(graph) {
    const declaration = new Array();
    const excludeCollectionNodes = findNodesByType(graph, DefoldGraphNodeType.ExcludedCollectionProxy);
    for (const collectionNode of excludeCollectionNodes) {
        const collectionChild = findNodeByPath(graph, collectionNode.children[0]);
        if (!collectionChild) {
            throw new Error("One of graph nodes with excludeCollection type doesn't contains child.");
        }
        const archiveName = (0, path_1.parse)(collectionChild.path).name;
        const archiveAssets = findChildrenForNodeRecursive(graph, collectionNode).map((node) => node.hexDigest);
        declaration.push(new DefoldResourceAchive(archiveName, archiveAssets));
    }
    return declaration;
}
function splitByGroups(graph, groups) {
    const declaration = new Array();
    const archives = new Map();
    const excludeCollectionNodes = findNodesByType(graph, DefoldGraphNodeType.ExcludedCollectionProxy);
    for (const collectionNode of excludeCollectionNodes) {
        const collectionChild = findNodeByPath(graph, collectionNode.children[0]);
        if (!collectionChild) {
            throw new Error("One of graph nodes with excludeCollection type doesn't contains child.");
        }
        const collectionName = (0, path_1.parse)(collectionChild.path).name;
        const group = groups.find((group) => group.collectionNames.includes(collectionName));
        if (!group) {
            continue;
        }
        if (!archives.has(group.name)) {
            const archive = new DefoldResourceAchive(group.name, new Array());
            archives.set(group.name, archive);
            declaration.push(archive);
        }
        const archiveAssets = findChildrenForNodeRecursive(graph, collectionNode).map((node) => node.hexDigest);
        archives.get(group.name).assets.push(...archiveAssets);
    }
    return declaration;
}
function findNodesByType(graph, type) {
    return graph.filter((node) => node.nodeType == type);
}
function findNodeByPath(graph, path) {
    return graph.find((node) => node.path === path);
}
function findChildrenForNodeRecursive(graph, node) {
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
//# sourceMappingURL=index.js.map