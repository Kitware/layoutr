function union(setA, setB) {
  var _union = new Set(setA);
  for (var elem of setB) {
      _union.add(elem);
  }
  return _union;
}

function intersection(setA, setB) {
  var _intersection = new Set();
  for (var elem of setB) {
      if (setA.has(elem)) {
          _intersection.add(elem);
      }
  }
  return _intersection;
}

function symmetricDifference(setA, setB) {
  var _difference = new Set(setA);
  for (var elem of setB) {
      if (_difference.has(elem)) {
          _difference.delete(elem);
      } else {
          _difference.add(elem);
      }
  }
  return _difference;
}

function difference(setA, setB) {
  var _difference = new Set(setA);
  for (var elem of setB) {
      _difference.delete(elem);
  }
  return _difference;
}

function connectedComponents (nodes) {
  let cliques = new Set();
  for (let i = 0, len = nodes.length; i < len; i++) {
    const clique = {nodes: [nodes[i]]};
    nodes[i].index = i;
    nodes[i].clique = clique;
    cliques.add(clique);
  }
  for (clique of cliques) {
    clique.adj = [...clique.nodes[0].adj].map(n => n.clique);
  }
  let join = true;
  for (let iteration = 0; iteration < nodes.length; iteration += 1) {
    if (!join) {
      break;
    }
    join = false;
    console.log(cliques.size);
    for (let clique1 of cliques) {
      for (let clique2 of cliques) {
        if (clique1 === clique2) {
          break;
        }
        join = clique1.adj.includes(clique2);
        if (join) {
          const joined = {nodes: [...clique1.nodes, ...clique2.nodes], adj: [...new Set([...clique1.adj, ...clique2.adj])]};
          cliques.delete(clique1);
          cliques.delete(clique2);
          cliques.add(joined);
          for (clique of cliques) {
            let index = clique.adj.indexOf(clique1);
            if (index > -1) {
              clique.adj.splice(index, 1);
              clique.adj.push(joined);
            }
            index = clique.adj.indexOf(clique2);
            if (index > -1) {
              clique.adj.splice(index, 1);
              clique.adj.push(joined);
            }
          }
          break;
        }
      }
      if (join) {
        break;
      }
    }
  }
  return cliques;
}

function findCliques(nodes) {
  let cliques = new Set();
  for (let i = 0, len = nodes.length; i < len; i++) {
    const clique = [nodes[i]];
    cliques.add(clique);
  }
  let join = true;
  for (let iteration = 0; iteration < nodes.length; iteration += 1) {
    if (!join) {
      break;
    }
    join = false;
    console.log(cliques.size);
    for (let clique1 of cliques) {
      for (let clique2 of cliques) {
        if (clique1 === clique2) {
          break;
        }
        join = true;
        for (let i = 0; i < clique1.length; i += 1) {
          for (let j = 0; j < clique2.length; j += 1) {
            n1 = clique1[i];
            n2 = clique2[j];
            if (!n1.adj.has(n2)) {
              join = false;
              break;
            }
          }
          if (!join) {
            break;
          }
        }
        if (join) {
          // console.log('join');
          const joined = [...clique1, ...clique2];
          cliques.delete(clique1);
          cliques.delete(clique2);
          cliques.add(joined);
          break;
        }
      }
      if (join) {
        break;
      }
    }
  }
  return cliques;
}

let total = 0;
function bronKerbosch1(R, P, X, cliques) {
  // console.log(R, P, X, cliques);
  if (P.size === 0 && X.size === 0) {
    console.log(R);
    cliques.push(R);
    total += R.size;
    console.log(`${total} / ${nodes.length}`);
  }
  let Parr = [...P];
  for (let i = 0; i < Parr.length; i += 1) {
    // console.log(Parr);
    let v = Parr[i];
    bronKerbosch1(union(R, new Set([v])), intersection(P, v.adj), intersection(X, v.adj), cliques);
    P = difference(P, new Set([v]));
    X = union(X, new Set([v]));
  }
}

testNodes = [
  { id: 0, adj: [1, 4] },
  { id: 1, adj: [2, 4, 0] },
  { id: 2, adj: [3, 1] },
  { id: 3, adj: [5, 2, 4] },
  { id: 4, adj: [3, 1, 0] },
  { id: 5, adj: [3] },
];
testNodes.forEach(n => {
  n.adj = n.adj.map(a => testNodes[a]);
})


// const cliques = [];
// // bronKerbosch1(new Set(), new Set(testNodes), new Set(), cliques);
// bronKerbosch1(new Set(), new Set(nodes), new Set(), cliques);

// // const cliques = findCliques(nodes.slice(0, 1000));

// console.log(cliques);
