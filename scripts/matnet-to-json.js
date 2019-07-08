const fs = require('fs');

fs.readFile(process.argv[2], 'utf-8', (err, data) => {
  let graph = JSON.parse(data);
  let out = {
    nodes: Object.keys(graph.nodes).map(id => ({ ...graph.nodes[id], id })),
    edges: graph.edges.map(e => ({ source: e[0], target: e[1] })),
  }
  console.log(JSON.stringify(out, null, 2));
});
