// let csv_data;
// let treeData, margin, tree, table, svg, g;

// FILENAME is static, but add a random variable to the end to prevent browser caching,
// aka - "I changed the content of the file, but why isn't that stuff drawing?!"
const FILENAME = "data2.csv" + "?nocache=" + Date.now(); 

// set the dimensions and margins of the diagram
const margin = { top: 40, right: 45, bottom: 30, left: 150 };

// Use the parsed tree data to dynamically create height & width
const width = 2500 - margin.left - margin.right,
height = 2540 - margin.top - margin.bottom;




// FUNCTIONS
const tree = d3.tree().size([height, width]);
const stratify = d3.stratify().id(d => d.id).parentId(d => d.parent_id);
const parse_row = d => ({
    // NOTE: This stuff is VERY tightly coupled to the format of the inventory data export. 
    //       Because there are no headers in the CSV export file, the column order is
    //       extremely important and needs to be carefully paid attention to.        
    id: d[0],
    resource_type: d[1],
    category: d[2],
    resource_id: d[3],
    parent_id: (d[1] == 'organization' ? "" : d[4]),
    resource_name: (d[5] != '' ? d[5] : d[6]),
    image: getImageURL(d[1])
})

// DOM
const svg = d3.select("body").append("svg")
.attr("width", width + margin.left + margin.right)
.attr("height", height + margin.top + margin.bottom);

const g = svg.append("g")
.attr("transform", `translate(${margin.left},${margin.top})`);


// UPDATE

const nodeEnterSettings = node => {
    const nodeEnter = node
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${source.y},${source.x})`)
        .on("click", function(d) {
        toggle(d);
        update(d);
        });

    nodeEnter.append("circle")
        .attr("r", 22)
        .style("fill", d => d._children ? "lightsteelblue" : "#fff")
        .style("fill-opacity", d => d._children ? 1 : 0)
        .style("stroke", "white")
        .style("stroke-opacity", 0);

    // adds the image to the node
    nodeEnter.append("image")
        .attr("xlink:href", d => d.data.image)
        .attr("x", d => -16)
        .attr("y", d => -16)
        .attr("height", 35)
        .attr("width", 35);

    // adds the text to the node
    nodeEnter.append("text")
        .attr("x", d => d.children ? -25 : 25)
        .attr("dy", ".35em")
        .style("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.name);
    return nodeEnter;
}

const nodeExitSettings = (node, DURATION) => {
    const nodeExit = node
        .exit()
        .transition()
        .duration(DURATION)
        .attr("transform", d => `translate(${source.y},${source.x})`)
        .remove();

    nodeExit.select("circle")
        .attr("r", 1e-6);

    nodeExit.select("text")
        .style("fill-opacity", 1e-6);
    
    return nodeExit;
}

const nodeUpdateSettings = (nodeUpdate, DURATION) => {
    nodeUpdate.transition()
    .duration(DURATION)
    .attr("transform", d => `translate(${d.y},${d.x})`);

    nodeUpdate.select("circle")
    .attr("r", 22)
    .style("fill", d => d._children ? "lightsteelblue" : "#fff")
    .style("fill-opacity", d => d._children ? 1 : 0)
    .style("stroke-opacity", 0);

    nodeUpdate.select("text").style("fill-opacity", 1);

    return nodeUpdate;
}

async function main() {
    const csv_data = await d3.text(FILENAME);
    console.log ("CSV loaded");
    
    table = d3.csvParseRows(csv_data, parse_row);
    treeData = stratify(table)
    treeData.each(d =>{ d.name = d.data.resource_name })
    treeData.children.forEach(collapse);
    update(treeData);
}


function update(source) {
    tree(treeData);
  
    treeData.each(d => { d.y = d.depth * 180 });

    const node = g.selectAll('.node')
        .data(treeData.descendants(), d => (d.id || (d.id = ++i)));
 
    const nodeEnter = nodeEnterSettings(node)
    const ANIMATION_DURATION_MS = 500;
  
    nodeUpdateSettings(nodeEnter.merge(node), ANIMATION_DURATION_MS);
    nodeExitSettings(node, ANIMATION_DURATION_MS)

    const link = g.selectAll(".link")
        .data(treeData.links(), d => d.target.id);

    const linkEnter = link.enter().insert('path', "g")
        .attr("class", "link")
        .attr("d", d3.linkHorizontal()
        .x(d => source.y)
        .y(d => source.x));

    const linkUpdate = linkEnter.merge(link);
    linkUpdate
        .transition()
        .duration(ANIMATION_DURATION_MS)
        .attr("d", d3.linkHorizontal()
        .x(d => d.y)
        .y(d => d.x));

    link
        .exit()
        .transition()
        .duration(ANIMATION_DURATION_MS)
        .attr("d", d3.linkHorizontal()
        .x(d => source.y)
        .y(d => source.x)
        )
        .remove();

    node.each(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
    });
}
