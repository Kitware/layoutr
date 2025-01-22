import * as d3 from 'd3';
import { Link, Node, SerializedGraph, SerializedLink, SimLink, SimNode } from './types';

postMessage({type: 'ready'});

let size = 1;
let linkStrength = 1;
// let xField = 'None';
// let yField = 'None';
// let radialField = 'None';

let linkStrengthFunctions = {
  inverseMinDegree: (link: SimLink, _index: number, _links: SimLink[]) => linkStrength * (link as Link).weight / Math.min((link.source as Node).degree, (link.target as Node).degree),
  inverseSumDegree: (link: SimLink, _index: number, _links: SimLink[]) => linkStrength / ((link.source as Node).degree + (link.target as Node).degree),
  inverseSumSqrtDegree: (link: SimLink, _index: number, _links: SimLink[]) => linkStrength / (Math.sqrt((link.source as Node).degree) + Math.sqrt((link.target as Node).degree)),
  constant: (_link: SimLink, _index: number, _links: SimLink[]) => linkStrength,
  radius: (link: SimLink, _index: number, _links: SimLink[]) => linkStrength*linkStrength / Math.min(collide.radius()(link.source as SimNode, 0, []), collide.radius()(link.target as SimNode, 0, [])),
};

let linkDistanceFunctions = {
  sumSqrtDegree: (link: SimLink, _index: number, _links: SimLink[]) => (Math.sqrt((link.source as Node).degree) + Math.sqrt((link.target as Node).degree)) * size / (link as Link).weight,
  constant: (_link: SimLink, _index: number, _links: SimLink[]) => size / 20,
  radius: (link: SimLink, _index: number, _links: SimLink[]) => (2 - linkStrength) * (collide.radius()(link.source as SimNode, 0, []) + collide.radius()(link.target as SimNode, 0, [])),
};

let link = d3.forceLink().id(d => (d as Node).id).distance(linkDistanceFunctions.sumSqrtDegree).strength(linkStrengthFunctions.inverseMinDegree);
let charge = d3.forceManyBody();
let collide = d3.forceCollide();
let center = d3.forceCenter();
// let x = d3.forceX();
// let y = d3.forceY();
// let radial = d3.forceRadial(0);
let gravity = d3.forceRadial(0);
let simulation = d3.forceSimulation()
  .alphaMin(0)
  .alphaTarget(0)
  .alphaDecay(0)
  .stop();

const loadGraph = (graph: SerializedGraph) => {
  function tick() {
    postMessage({type: 'positions', positions: graph.nodes!.map(n => ({x: n.x, y: n.y}))});
  }

  // Normalize links
  graph.links = graph.links || graph.edges;
  graph.links = graph.links.map(d => {
    let link = d;
    if (Array.isArray(link)) {
      link = {
        source: d[0],
        target: d[1],
        weight: d[2] === undefined ? 1 : d[2],
      };
    }
    link.source = '' + link.source;
    link.target = '' + link.target;
    link.weight = link.weight === undefined ? 1 : +link.weight;
    return link;
  });

  if (!graph.nodes) {
    graph.nodes = Array.from(new Set([...graph.links.map(d => d.source), ...graph.links.map(d => d.target)])).map((d, i) => ({
      degree: 0,
      id: d,
      index: i,
    }));
  }
  const nodeMap: {[key: number | string]: Node} = {};
  graph.nodes.forEach((d, i) => {
    d.degree = 0;
    d.id = '' + d.id;
    d.index = i;
    nodeMap[d.id] = d;
  });
  graph.links = graph.links.filter(e => nodeMap[e.source] && nodeMap[e.target]);
  graph.links.forEach(d => {
    const weight = d.weight !== undefined ? +d.weight : 1
    nodeMap[d.source].degree = +nodeMap[d.source].degree + weight;
    nodeMap[d.target].degree = +nodeMap[d.target].degree + weight;
  });

  graph.nodes.sort((a, b) => d3.ascending(a.degree, b.degree));
  simulation
    .nodes(graph.nodes as SimNode[])
    .on('tick', tick);

  postMessage({type: 'graph', graph});
  postMessage({type: 'positions', positions: graph.nodes.map(n => ({x: n.x, y: n.y}))});

  // Initialize data-dependent scales

  // x.x(scales.generateScale(simulation.nodes() as Node[], xField, {area: 1000}));
  // y.y(scales.generateScale(simulation.nodes() as Node[], yField, {area: 1000}));
  // radial.radius(scales.generateScale(
  //   simulation.nodes() as Node[], radialField, {area: 1000, min: 0.5, max: 1.5, invalid: 1.6},
  // ));

  let oldLink = simulation.force('link') || null;
  simulation.force('link', link);
  link.links(graph.links);
  simulation.force('link', oldLink);
}

onmessage = function(e) {
  if (e.data.type === 'start') {
    simulation.restart();
  } else if (e.data.type === 'stop') {
    simulation.stop();
  } else if (e.data.type === 'loadCSV') {
    loadGraph({links: d3.csvParse(e.data.text) as unknown as SerializedLink[]} as SerializedGraph);
  } else if (e.data.type === 'loadGraph') {
    loadGraph(e.data.graph);
  } else if (e.data.type === 'chargeApproximation') {
    charge.theta(e.data.value);
  } else if (e.data.type === 'energy') {
    simulation.alpha(e.data.value);
  } else if (e.data.type === 'radii') {
    collide.radius((_d, i) => e.data.value[i]);
  } else if (e.data.type === 'linkFactor') {
    simulation.force('link', e.data.value ? link : null);
    linkStrength = e.data.value;
    link.distance(link.distance());
    link.strength(link.strength());
  } else if (e.data.type === 'chargeStrength') {
    simulation.force('charge', e.data.value ? charge : null);
    charge.strength(-e.data.value);
  } else if (e.data.type === 'chargeFactor') {
    console.log('Use chargeStrength to change charge');
  } else if (e.data.type === 'collideFactor') {
    simulation.force('collide', e.data.value ? collide : null);
    collide.strength(e.data.value);
  } else if (e.data.type === 'centerForce') {
    simulation.force('center', e.data.value ? center : null);
  } else if (e.data.type === 'xForce') {
  //   simulation.force('x', e.data.value ? x : null);
  //   x.strength(e.data.value);
  } else if (e.data.type === 'xField') {
  //   xField = e.data.value;
  //   x.x(scales.generateScale(simulation.nodes() as Node[], xField, {area: 1000}));
  } else if (e.data.type === 'yForce') {
  //   simulation.force('y', e.data.value ? y : null);
  //   y.strength(e.data.value);
  } else if (e.data.type === 'yField') {
  //   yField = e.data.value;
  //   y.y(scales.generateScale(simulation.nodes() as Node[], yField, {min: 0.5, max: -0.5, area: 1000}));
  } else if (e.data.type === 'radialForce') {
  //   simulation.force('radial', e.data.value ? radial : null);
  //   radial.strength(e.data.value);
  } else if (e.data.type === 'radialField') {
  //   radialField = e.data.value;
  //   radial.radius(scales.generateScale(
  //     simulation.nodes() as Node[], radialField, {area: 1000, min: 0.5, max: 1.5, invalid: 1.6},
  //   ));
  } else if (e.data.type === 'gravity') {
    simulation.force('gravity', e.data.value ? gravity : null);
    gravity.strength(e.data.value);
  } else {
    throw Error(`Unknown message type '${e.data.type}'`);
  }
};
