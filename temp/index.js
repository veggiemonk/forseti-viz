// set the dimensions and margins of the diagram
const margin = { top: 40, right: 45, bottom: 30, left: 150 };

// Use the parsed tree data to dynamically create height & width
const width = 1200 - margin.left - margin.right,
    height = 1200 - margin.top - margin.bottom;

const stratify = d3
    .stratify()
    .id(d => d.id)
    .parentId(d => d.parent_id);

const parse_row = d => ({
    // NOTE: This stuff is VERY tightly coupled to the format of the inventory data export.
    //       Because there are no headers in the CSV export file, the column order is
    //       extremely important and needs to be carefully paid attention to.
    id: d[0],
    resource_type: d[1],
    category: d[2],
    resource_id: d[3],
    parent_id: d[1] === "organization" ? "" : d[4],
    resource_name: d[5] !== "" ? d[5] : d[6],
    // image: getImageURL(d[1])
});

// --------------------------------------------------------------------------------
const drag = simulation => {

    function dragstarted(d) {
        if (!d3.event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
    }

    function dragended(d) {
        if (!d3.event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
};

const chart = function (root) {
    const links = root.links();
    const nodes = root.descendants();

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(0).strength(1))
        .force("charge", d3.forceManyBody().strength(-50))
        .force("x", d3.forceX())
        .force("y", d3.forceY());

    const svg = d3.create("svg")
        .attr("viewBox", [-width / 2, -height / 2, width, height]);

    const link = svg.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(links)
        .join("line");

    const node = svg.append("g")
        .attr("fill", "#fff")
        .attr("stroke", "#000")
        .attr("stroke-width", 1.5)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("fill", d => d.children ? null : "#000")
        .attr("stroke", d => d.children ? null : "#fff")
        .attr("r", 3.5)
        .call(drag(simulation));

    node.append("title")
        .text(d => d.data.name);

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    });

    // invalidation.then(() => simulation.stop());

    return svg.node();
};

// ---------------------------------------------------------------------------------------------
const dx = 12;
const dy = 120;
const tree = d3.tree().nodeSize([dx, dy]);
const treeLink = d3.linkHorizontal().x(d => d.y).y(d => d.x);

function graph(root, {
    label = d => d.data.id,
    highlight = () => false,
    marginLeft = 40
} = {}) {
    root = tree(root);

    let x0 = Infinity;
    let x1 = -x0;
    root.each(d => {
        if (d.x > x1) x1 = d.x;
        if (d.x < x0) x0 = d.x;
    });

    const svg = d3.create("svg")
        .attr("viewBox", [0, 0, width, x1 - x0 + dx * 2])
        .style("overflow", "visible");

    const g = svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("transform", `translate(${marginLeft},${dx - x0})`);

    const link = g.append("g")
        .attr("fill", "none")
        .attr("stroke", "#555")
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1.5)
        .selectAll("path")
        .data(root.links())
        .join("path")
        .attr("stroke", d => highlight(d.source) && highlight(d.target) ? "red" : null)
        .attr("stroke-opacity", d => highlight(d.source) && highlight(d.target) ? 1 : null)
        .attr("d", treeLink);

    const node = g.append("g")
        .attr("stroke-linejoin", "round")
        .attr("stroke-width", 3)
        .selectAll("g")
        .data(root.descendants())
        .join("g")
        .attr("transform", d => `translate(${d.y},${d.x})`);

    node.append("circle")
        .attr("fill", d => highlight(d) ? "red" : d.children ? "#555" : "#999")
        .attr("r", 2.5);

    node.append("text")
        .attr("fill", d => highlight(d) ? "red" : null)
        .attr("dy", "0.31em")
        .attr("x", d => d.children ? -6 : 6)
        .attr("text-anchor", d => d.children ? "end" : "start")
        .text(label)
        .clone(true).lower()
        .attr("stroke", "white");

    return svg.node();
}


// ------------------------------------------------------------------

const pack = data => d3.pack()
    .size([width, height])
    .padding(3)
    (d3.hierarchy(data)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value));

function circlepack(data) {
const root = pack(data);

const svg = d3.create("svg")
    .attr("viewBox", [0, 0, width, height])
    .style("font", "10px sans-serif")
    .style("overflow", "visible")
    .attr("text-anchor", "middle");

const node = svg.append("g")
    .attr("pointer-events", "all")
    .selectAll("g")
    .data(root.descendants())
    .join("g")
    .attr("transform", d => `translate(${d.x},${d.y})`);

node.append("circle")
    .attr("r", d => d.r)
    .attr("stroke", d => d.children ? "#bbb" : "none")
    .attr("fill", d => d.children ? "none" : "#ddd");

const leaf = node.filter(d => !d.children);

leaf.select("circle")
    .attr("id", d => (d.leafUid = DOM.uid("leaf")).id);

leaf.append("clipPath")
    .attr("id", d => (d.clipUid = DOM.uid("clip")).id)
    .append("use")
    .attr("xlink:href", d => d.leafUid.href);

leaf.append("text")
    .attr("clip-path", d => d.clipUid)
    .selectAll("tspan")
    .data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g))
    .join("tspan")
    .attr("x", 0)
    .attr("y", (d, i, nodes) => `${i - nodes.length / 2 + 0.8}em`)
    .text(d => d);

node.append("title")
    .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}
${d.value.toLocaleString()}`);

return svg.node();
}

// --------------------------------------------------------


const color = d3.scaleSequential(d3.interpolateMagma).domain([8, 0]);
const format = d3.format(",d");
// const width = 932;
// const height = width;

const {DOM} = new observablehq.Library;

function draw(data) {
    const pack2 = data => d3.pack()
    .size([width, height])
    .padding(3)
    (d3.hierarchy(data)
        .sum(d => d.size)
        .sort((a, b) => b.size - a.size));


  const root = pack2(data);
  // const svg = d3.create("svg")
      // .attr("viewBox", [-width / 2, -height / 2, width, height])
    const svg = d3.select('#packSVG')
    .style("font", "10px sans-serif")
    .style("width", "100%")
    .style("height", "auto")
    .attr("text-anchor", "middle");

  const node = svg.selectAll("g")
      .data(root.descendants())
      .enter().append("g")
      .attr("transform", d => `translate(${d.x + 1},${d.y + 1})`);

  node.append("circle")
    .attr("r", d => d.r)
    .attr("fill", d => color(d.height));

  const leaf = node.filter(d => !d.children);

  leaf.select("circle")
    .attr("id", d => (d.leafUid = DOM.uid("leaf")).id)
    .attr("stroke", "#000");

  leaf.append("clipPath")
    .attr("id", d => (d.clipUid = DOM.uid("clip")).id)
    .append("use")
    .attr("xlink:href", d => d.leafUid.href);

  leaf.append("text")
    .attr("clip-path", d => d.clipUid)
    .selectAll("tspan")
    .data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g))
    .enter().append("tspan")
    .attr("x", 0)
    .attr("y", (d, i, nodes) => `${i - nodes.length / 2 + 0.8}em`)
    .text(d => d);

  node.append("title")
    .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${format(d.value)}`);

    // return svg.node();
}


// --------------------------------------------------------


function main(csv_data) {
    const table = d3.csvParseRows(csv_data, parse_row);
    const treeData = stratify(table);
    treeData.each(d => {
        d.name = d.data.resource_name;
        d.size = 1000 - (d.depth * d.depth) ;
    });

    draw(treeData);
    // d3.select("body")
    //     .append(function(){
    //         // return chart(treeData);
    //         // return graph(treeData);
    //         return circlepack(treeData);
    //
    //     })
    //     .attr("width", width + margin.left + margin.right)
    //     .attr("height", height + margin.top + margin.bottom);
}




main(window.data);