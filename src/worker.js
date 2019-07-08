let d3 = require('d3/dist/d3.js');

let radiusFactor = 2;
let linkStrength = 0.1;

let linkStrengthFunctions = {
  inverseMinDegree: link => linkStrength / Math.min(link.source.degree, link.target.degree),
  inverseSumDegree: link => linkStrength / (link.source.degree + link.target.degree),
  inverseSumSqrtDegree: link => linkStrength / (Math.sqrt(link.source.degree) + Math.sqrt(link.target.degree)),
};

let linkDistanceFunctions = {
  sumSqrtDegree: link => (Math.sqrt(link.source.degree) + Math.sqrt(link.target.degree)) * radiusFactor,
};

let link = d3.forceLink().id(d => d.id).distance(linkDistanceFunctions.sumSqrtDegree).strength(linkStrengthFunctions.inverseMinDegree);
let charge = d3.forceManyBody();
let collide = d3.forceCollide().radius(d => Math.sqrt(d.degree) * radiusFactor);
let center = d3.forceCenter();
let simulation = d3.forceSimulation()
  .force('link', link)
  .force('charge', charge)
  .force('collide', collide)
  .force('center', center)
  .alphaMin(0)
  .alphaTarget(0)
  .stop();

loadGraph = function(graph) {
  function tick() {
    postMessage({type: 'alpha', value: simulation.alpha()});
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

  let oldLink = simulation.force('link');
  simulation.force('link', link);
  link.links(graph.edges);
  simulation.force('link', oldLink);
}

onmessage = function(e) {
  if (e.data.type === 'stop') {
    simulation.stop();
  }
  else if (e.data.type === 'start') {
    simulation.restart();
  }
  else if (e.data.type === 'loadEdgeList') {
    loadGraph({edges: d3.csvParse(e.data.text)});
  }
  else if (e.data.type === 'theta') {
    charge.theta(e.data.value);
  }
  else if (e.data.type === 'alpha') {
    simulation.alpha(e.data.value);
  }
  else if (e.data.type === 'radiusFactor') {
    radiusFactor = e.data.value;
    link.strength(linkStrengthFunctions.inverseMinDegree);
    collide.radius(d => Math.sqrt(d.degree) * radiusFactor);
  }
  else if (e.data.type === 'linkStrength') {
    linkStrength = e.data.value;
    link.strength(linkStrengthFunctions.inverseMinDegree);
  }
  else if (e.data.type === 'chargeStrength') {
    charge.strength(e.data.value);
  }
  else if (e.data.type === 'collideStrength') {
    collide.strength(e.data.value);
  }
  else if (e.data.type === 'collide') {
    simulation.force('collide', e.data.value ? collide : null);
  }
  else if (e.data.type === 'link') {
    simulation.force('link', e.data.value ? link : null);
  }
  else if (e.data.type === 'charge') {
    simulation.force('charge', e.data.value ? charge : null);
  }
  else if (e.data.type === 'center') {
    simulation.force('center', e.data.value ? center : null);
  }
  else {
    throw Error(`Unknown message type '${e.data.type}'`);
  }
}
