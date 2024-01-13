export declare enum SplitMethod {
    ByCollections = 0,
    ByGroups = 1
}
export declare class SplitGroup {
    name: string;
    collectionNames: string[];
    constructor(name: string, collectionNames: string[]);
}
export declare class SplitOptions {
    method: SplitMethod;
    groups: SplitGroup[] | null;
    output: string | null;
    static byCollections(output?: string | null): SplitOptions;
    static byGroups(groups: SplitGroup[], output?: string | null): SplitOptions;
}
export declare function split(pathToGraph: string, pathToArchive: string, options: SplitOptions): Promise<void>;
//# sourceMappingURL=index.d.ts.map