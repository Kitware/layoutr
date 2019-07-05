let d3 = require('d3/dist/d3.js');

let link = d3.forceLink().id(d => d.id).distance(400);
let charge = d3.forceManyBody();
let collide = d3.forceCollide().radius(d => Math.sqrt(d.degree));
let simulation;

loadGraph = function(graph) {
  if (simulation) {
    simulation.stop();
  }

  simulation = d3.forceSimulation()
    .force('link', link)
    .force('charge', charge)
    .force('collide', collide);

  function tick() {
    postMessage({type: 'positions', nodes: graph.nodes.map(n => ({x: n.x, y: n.y}))});
  }

  if (!graph.nodes) {
    graph.nodes = d3.set([...graph.edges.map(d => d.source), ...graph.edges.map(d => d.target)]).values().map(d => ({
      id: d,
      degree: 0,
      x: Math.random()*1000,
      y: Math.random()*1000,
    }));
  }
  const nodeMap = {};
  graph.nodes.forEach(d => {
    nodeMap[d.id] = d;
  });
  graph.edges.forEach(d => {
    nodeMap[d.source].degree += 1;
    nodeMap[d.target].degree += 1;
  });

  graph.nodes.sort((a, b) => d3.ascending(a.degree, b.degree));
  simulation
    .nodes(graph.nodes)
    .on('tick', tick);

  postMessage({type: 'graph', graph: {
    nodes: graph.nodes.map(n => ({id: n.id, degree: n.degree, x: n.x, y: n.y})),
    edges: graph.edges,
  }});

  simulation.force('link')
    .links(graph.edges);
}

onmessage = function(e) {
  if (e.data.type === 'stop') {
    simulation.stop();
  }
  else if (e.data.type === 'start') {
    simulation.alpha(1);
    simulation.restart();
  }
  else if (e.data.type === 'loadEdgeList') {
    loadGraph({edges: d3.csvParse(e.data.text)});
  }
  else if (e.data.type === 'theta') {
    charge.theta(e.data.value);
  }
  else if (e.data.type === 'collide') {
    simulation.collide(e.data.enabled ? collide : null);
  }
  else {
    throw Error(`Unknown message type '${e.data.type}'`);
  }
}
