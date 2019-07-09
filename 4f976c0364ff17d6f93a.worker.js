/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/worker.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./src/worker.js":
/*!***********************!*\
  !*** ./src/worker.js ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("importScripts('d3/dist/d3.js');\n\nlet link = d3.forceLink().id(d => d.id).distance(400);\nlet charge = d3.forceManyBody();\nlet collide = d3.forceCollide().radius(d => Math.sqrt(d.degree));\nlet simulation;\n\nloadGraph = function(graph) {\n  simulation = d3.forceSimulation()\n    .force('link', link)\n    .force('charge', charge)\n    .force('collide', collide);\n\n  function tick() {\n    console.log(graph);\n    postMessage({type: 'positions', nodes: graph.nodes.map(n => ({x: n.x, y: n.y}))});\n  }\n  if (!graph.nodes) {\n    graph.nodes = d3.set([...graph.edges.map(d => d.source), ...graph.edges.map(d => d.target)]).values().map(d => ({\n      id: d,\n      degree: 0,\n      x: Math.random()*1000,\n      y: Math.random()*1000,\n    }));\n  }\n  const nodeMap = {};\n  graph.nodes.forEach(d => {\n    nodeMap[d.id] = d;\n  });\n  graph.edges.forEach(d => {\n    nodeMap[d.source].degree += 1;\n    nodeMap[d.target].degree += 1;\n  });\n\n  graph.nodes.sort((a, b) => d3.ascending(a.degree, b.degree));\n  simulation\n    .nodes(graph.nodes)\n    .on('tick', tick);\n\n  postMessage({type: 'graph', graph: {\n    nodes: graph.nodes.map(n => ({id: n.id, degree: n.degree, x: n.x, y: n.y})),\n    edges: graph.edges,\n  }});\n\n  simulation.force('link')\n    .links(graph.edges);\n}\n\nonmessage = function(e) {\n  if (e.data.type === 'stop') {\n    simulation.stop();\n  }\n  else if (e.data.type === 'start') {\n    simulation.restart();\n  }\n  else if (e.data.type === 'loadEdgeList') {\n    loadGraph({edges: d3.csvParse(e.data.text)});\n  }\n  else if (e.data.type === 'theta') {\n    charge.theta(e.data.value);\n  }\n  else if (e.data.type === 'collide') {\n    simulation.collide(e.data.enabled ? collide : null);\n  }\n  else {\n    throw Error(`Unknown message type '${e.data.type}'`);\n  }\n}\n\n\n//# sourceURL=webpack:///./src/worker.js?");

/***/ })

/******/ });