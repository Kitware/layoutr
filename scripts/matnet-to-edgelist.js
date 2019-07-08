const fs = require('fs');

fs.readFile(process.argv[2], 'utf-8', (err, data) => {
  graph = JSON.parse(data);
  console.log(`source,target\n${graph.edges.map(d => d.join(',')).join('\n')}`);
});
