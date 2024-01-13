declare enum SplitMethod {
    ByCollections = 0,
    ByGroups = 1
}
declare class SplitGroup {
    name: string;
    collectionNames: string[];
    constructor(name: string, collectionNames: string[]);
}
declare class SplitOptions {
    method: SplitMethod;
    groups: SplitGroup[] | null;
    output: string | null;
    static byCollections(output?: string | null): SplitOptions;
    static byGroups(groups: SplitGroup[], output?: string | null): SplitOptions;
}
export declare function split(pathToGraph: string, pathToArchive: string, options: SplitOptions): Promise<void>;
export {};
//# sourceMappingURL=index.d.ts.map