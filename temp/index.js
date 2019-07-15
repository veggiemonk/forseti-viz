// set the dimensions and margins of the diagram
const margin = {top: 40, right: 45, bottom: 30, left: 150};

// Use the parsed tree data to dynamically create height & width
let width = 1200 - margin.left - margin.right;
let height = 1200 - margin.top - margin.bottom;


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


const stratify = d3
    .stratify()
    .id(d => d.id)
    .parentId(d => d.parent_id);

const pack = data => d3.pack()
    .size([width, height])
    .padding(3)
    (d3.hierarchy(data)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value));

const partition = data => {
    const root = d3.hierarchy(data)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);
    return d3.partition()
        .size([2 * Math.PI, root.height + 1])
        (root);
};

const format = d3.format(",d");
// const width = 932;
// const height = width;

const {DOM} = new observablehq.Library;


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

function circlepack_color(data) {
    const pack2 = data => d3.pack()
        .size([width, height])
        .padding(3)
        (d3.hierarchy(data)
            .sum(d => d.size)
            .sort((a, b) => b.size - a.size));


    const root = pack2(data);
    const svg = d3.create("svg")
        .style("font", "10px sans-serif")
        .style("width", "100%")
        .style("height", "1200px")
        .attr("text-anchor", "middle");

    const node = svg.selectAll("g")
        .data(root.descendants())
        .enter().append("g")
        .attr("transform", d => `translate(${d.x + 1},${d.y + 1})`);

    const color = d3.scaleSequential(d3.interpolateMagma).domain([8, 0]);

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

    return svg.node();
}


// --------------------------------------------------------

const radius = width / 6;

const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius * 1.5)
    .innerRadius(d => d.y0 * radius)
    .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));


function sunburst(data) {
    const root = partition(data);

    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));
    const svg = d3.create("svg")
        .style("max-width", "100%")
        .style("height", "auto")
        .style("font", "10px sans-serif")
        .style("margin", "5px");

    svg.append("g")
        .attr("fill-opacity", 0.6)
        .selectAll("path")
        .data(root.descendants().filter(d => d.depth))
        .enter().append("path")
        .attr("fill", d => {
            while (d.depth > 1) d = d.parent;
            return color(d.data.name);
        })
        .attr("d", arc)
        .append("title")
        .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${format(d.value)}`);

    svg.append("g")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .selectAll("text")
        .data(root.descendants().filter(d => d.depth && (d.y0 + d.y1) / 2 * (d.x1 - d.x0) > 10))
        .enter().append("text")
        .attr("transform", function (d) {
            const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
            const y = (d.y0 + d.y1) / 2;
            return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
        })
        .attr("dy", "0.35em")
        .text(d => d.data.name);

    return svg.node();
}

function zoomable_sunburst(data) {
    const root = partition(data);

    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));

    root.each(d => d.current = d);

    const svg = d3.create("svg")
        .attr("viewBox", [0, 0, width, width])
        .style("font", "10px sans-serif");

    const g = svg.append("g")
        .attr("transform", `translate(${width / 2},${width / 2})`);

    const path = g.append("g")
        .selectAll("path")
        .data(root.descendants().slice(1))
        .join("path")
        .attr("fill", d => {
            while (d.depth > 1) d = d.parent;
            return color(d.data.name);
        })
        .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
        .attr("d", d => arc(d.current));

    path.filter(d => d.children)
        .style("cursor", "pointer")
        .on("click", clicked);

    path.append("title")
        .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${format(d.value)}`);

    const label = g.append("g")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .style("user-select", "none")
        .selectAll("text")
        .data(root.descendants().slice(1))
        .join("text")
        .attr("dy", "0.35em")
        .attr("fill-opacity", d => +labelVisible(d.current))
        .attr("transform", d => labelTransform(d.current))
        .text(d => d.data.name);

    const parent = g.append("circle")
        .datum(root)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("click", clicked);

    function clicked(p) {
        parent.datum(p.parent || root);

        root.each(d => d.target = {
            x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            y0: Math.max(0, d.y0 - p.depth),
            y1: Math.max(0, d.y1 - p.depth)
        });

        const t = g.transition().duration(750);

        // Transition the data on all arcs, even the ones that aren’t visible,
        // so that if this transition is interrupted, entering arcs will start
        // the next transition from the desired position.
        path.transition(t)
            .tween("data", d => {
                const i = d3.interpolate(d.current, d.target);
                return t => d.current = i(t);
            })
            .filter(function (d) {
                return +this.getAttribute("fill-opacity") || arcVisible(d.target);
            })
            .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
            .attrTween("d", d => () => arc(d.current));

        label.filter(function (d) {
            return +this.getAttribute("fill-opacity") || labelVisible(d.target);
        }).transition(t)
            .attr("fill-opacity", d => +labelVisible(d.target))
            .attrTween("transform", d => () => labelTransform(d.current));
    }

    function arcVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2 * radius;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }

    return svg.node();
}

// --------------------------------------------------------


const treemap = data => d3.treemap()
// .tile(d3.treemapBinary)
// .tile(d3.treemapSliceDice)
    .tile(d3.treemapSquarify)
    .size([width, height])
    .padding(1)
    .round(true)
    (d3.hierarchy(data)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value));

//color = d3.scaleOrdinal(d3.schemeCategory10)

function draw_treemap(data) {
    const root = treemap(data);
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const svg = d3.create("svg")
        .attr("viewBox", [0, 0, width, height])
        .style("font", "10px sans-serif");

    const leaf = svg.selectAll("g")
        .data(root.leaves())
        .join("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    leaf.append("title")
        .text(d => `${d.ancestors().reverse().map(d => d.data.name).join("/")}\n${format(d.value)}`);

    leaf.append("rect")
        .attr("id", d => (d.leafUid = DOM.uid("leaf")).id)
        .attr("fill", d => {
            while (d.depth > 1) d = d.parent;
            return color(d.data.name);
        })
        .attr("fill-opacity", 0.6)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0);

    leaf.append("clipPath")
        .attr("id", d => (d.clipUid = DOM.uid("clip")).id)
        .append("use")
        .attr("xlink:href", d => d.leafUid.href);

    leaf.append("text")
        .attr("clip-path", d => d.clipUid)
        .selectAll("tspan")
        .data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g).concat(format(d.value)))
        .join("tspan")
        .attr("x", 3)
        .attr("y", (d, i, nodes) => `${(i === nodes.length - 1) * 0.3 + 1.1 + i * 0.9}em`)
        .attr("fill-opacity", (d, i, nodes) => i === nodes.length - 1 ? 0.7 : null)
        .text(d => d);

    return svg.node();
}

// -----------------------------------------------------------------------------

function processData(csv_data, draw) {
    const table = d3.csvParseRows(csv_data, parse_row);
    const treeData = stratify(table);
    treeData.each(d => {
        d.name = d.data.resource_name;
        d.size = 2000 - (d.depth * d.depth);
        d.value = 3000 - (d.depth * d.depth);
    });

    d3.select("body")
        .append(function () {
            console.log("rendered");

            // return chart(treeData);
            // return graph(treeData);
            // return circlepack(treeData);
            // return circlepack_color(treeData);
            // return sunburst(treeData);
            // return zoomable_sunburst(treeData);
            // return draw_treemap(treeData);
            return draw(treeData);
        })
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
}

function main() {
    const sel = document.getElementById("sel");
    const draw_function = sel.options[sel.selectedIndex].value;
    // console.log({ draw_function }, {x : eval(draw_function)});
    sel.onchange = e => {
        document.getElementsByName("svg")
        processData(window.data, eval(sel.options[sel.selectedIndex].value));
    };

    processData(window.data, eval(draw_function));

}

main();

