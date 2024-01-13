# DefSplitJS
The nodejs module to split Defold liveupdate archive into multiple archives
## Install
DefSplitJs requires Node.js to use it
```sh
npm i defsplitjs
```
## Usage
##### Split by collections
```js
const pathToGraph = join(PROJECT_PATH, "./build/default/game.graph.json");
const pathToArchive = join(PUBLISH_PATH, "resourcepack.zip");
const splitOptions = SplitOptions.byCollections();
await split(pathToGraph, pathToArchive, splitOptions)
```
##### Split by groups
```js
const pathToGraph = join(PROJECT_PATH, "./build/default/game.graph.json");
const pathToArchive = join(PUBLISH_PATH, "resourcepack.zip");
const splitOptions = SplitOptions.byGroups([
    new SplitGroup("level01", ["level01"]),
    new SplitGroup("level02", ["level02"]),
]);
await split(pathToGraph, pathToArchive, splitOptions)
```