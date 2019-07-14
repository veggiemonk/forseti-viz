const { DOM } = new observablehq.Library();

const format = d3.format(",d");

function main(data = window.data) {
  const treeData = prepare_data(data);

  document.getElementById("sel").onchange = e => {
    console.log("sel.onchange");
    process_data(get_all_values(treeData));
  };

  document.getElementById("height").onchange = e => {
    console.log("h.onchange");
    process_data(get_all_values(treeData));
  };

  document.getElementById("width").onchange = e => {
    console.log("w.onchange");
    process_data(get_all_values(treeData));
  };

  process_data(get_all_values(treeData));
}

function process_data({ data, height, width, margin, draw_function }) {
  Array.from(document.getElementsByTagName("svg")).forEach(x =>
    x.parentNode.removeChild(x)
  );

  d3.select("body").append(function() {
    console.log("rendered >> " + draw_function);
    switch (draw_function) {
      case "chart":
        console.log({ height: 800, width: 800 });
        return chart({ data, height: 800, width: 800 });

      case "graph":
        console.log({ height: 21000, width });
        return graph({ data, height: 21000, width });

      case "zoomable_sunburst":
        console.log({ height, width });
        return zoomable_sunburst({ data, width, height });

      case "circlepack_color":
        console.log({ height, width });
        return circlepack_color({ data, height, width });

      case "collapsable_tree":
        console.log({ height, width, margin });
        return collapsable_tree({ data, height, width, margin });

      case "hierarchy_tree":
        console.log({ height, width });
        return hierarchy_tree({ data, height, width });

      default:
        console.log("ERROR: unknown function name:" + draw_function_name);
        return;
    }
  });
}

function get_all_values(data) {
  const sel = document.getElementById("sel");
  const draw_function = sel.options[sel.selectedIndex].value;
  const height = document.getElementById("height").value;
  const width = document.getElementById("width").value;
  const margin = { top: 40, right: 45, bottom: 30, left: 150 };

  return {
    draw_function,
    height,
    width,
    margin,
    data
  };
}

function prepare_data(data) {
  const stratify = d3
    .stratify()
    .id(d => d.id)
    .parentId(d => d.parent_id);

  const getImageURL = resource_type => {
    const URL_BASE = "https://storage.googleapis.com/mps-storage/mzinni/external/gcp-arch-viz-images/";
    // const URL_BASE = "icons/";
    let imageFilename = "extras/google_cloud_platform.png";

    switch (resource_type) {
      case "organization":
        imageFilename = "cloud_logo.png";
        break;

      case "folder":
        imageFilename = "folder_logo.png";
        break;

      case "project":
        imageFilename = "project_logo.png";
        break;

      case "appengine_app":
        imageFilename = "compute/app_engine.png";
        break;

      case "kubernetes_cluster":
        imageFilename = "compute/container_engine.png";
        break;

      case "cloudsqlinstance":
        imageFilename = "storage___databases/cloud_sql.png";
        break;

      case "bucket":
        imageFilename = "storage___databases/cloud_storage.png";
        break;

      case "disk":
        imageFilename = "storage___databases/persistent_disk.png";
        break;

      default:
        imageFilename = "extras/generic_gcp.png";
        break;
    }
    return URL_BASE + imageFilename;
  };

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
    image: getImageURL(d[1])
  });

  const table = d3.csvParseRows(data, parse_row);
  const treeData = stratify(table);

  treeData.each(d => {
    d.name = d.data.resource_name;
    d.size = 2000 - Math.pow(d.depth, 2);
    d.value = 3000 - Math.pow(d.depth, 2);
  });

  return treeData;
}

// --------------------------------------------------------------------------------------------------------------------

function chart({ data: root, height, width }) {
  const svg = d3
    .create("svg")
    .attr("viewBox", [-width / 2, -height / 2, width, height]);

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

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  };

  const links = root.links();
  const nodes = root.descendants();

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id(d => d.id)
        .distance(0)
        .strength(1)
    )
    .force("charge", d3.forceManyBody().strength(-50))
    .force("x", d3.forceX())
    .force("y", d3.forceY());

  const link = svg
    .append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line");

  const node = svg
    .append("g")
    .attr("fill", "#fff")
    .attr("stroke", "#000")
    .attr("stroke-width", 1.5)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("fill", d => (d.children ? null : "#000"))
    .attr("stroke", d => (d.children ? null : "#fff"))
    .attr("r", 3.5)
    .call(drag(simulation));

  node.append("title").text(d => d.data.name);

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("cx", d => d.x).attr("cy", d => d.y);
  });

  return svg.node();
}

// --------------------------------------------------------------------------------------------------------------------
function graph({ data, height, width }) {
  const label = d => d.data.id;
  const highlight = () => false;
  const marginLeft = 40;
  const dx = 12;
  const dy = 120;

  const svg = d3
    .create("svg")
    .style("font", "10px sans-serif")
    .style("width", "100%")
    .style("height", height + "px")
    .style("overflow", "visible");

  const tree = d3.tree().nodeSize([dx, dy]);
  const treeLink = d3
    .linkHorizontal()
    .x(d => d.y)
    .y(d => d.x);

  const root = tree(data);

  let x0 = Infinity;
  let x1 = -x0;
  root.each(d => {
    if (d.x > x1) x1 = d.x;
    if (d.x < x0) x0 = d.x;
  });

  const g = svg
    .append("g")
    .attr("font-family", "sans-serif")
    .attr("font-size", 10)
    .attr("transform", `translate(${marginLeft},${dx - x0})`);

  const link = g
    .append("g")
    .attr("fill", "none")
    .attr("stroke", "#555")
    .attr("stroke-opacity", 0.4)
    .attr("stroke-width", 1.5)
    .selectAll("path")
    .data(root.links())
    .join("path")
    .attr("stroke", d =>
      highlight(d.source) && highlight(d.target) ? "red" : null
    )
    .attr("stroke-opacity", d =>
      highlight(d.source) && highlight(d.target) ? 1 : null
    )
    .attr("d", treeLink);

  const node = g
    .append("g")
    .attr("stroke-linejoin", "round")
    .attr("stroke-width", 3)
    .selectAll("g")
    .data(root.descendants())
    .join("g")
    .attr("transform", d => `translate(${d.y},${d.x})`);

  node
    .append("circle")
    .attr("fill", d => (highlight(d) ? "red" : d.children ? "#555" : "#999"))
    .attr("r", 2.5);

  node
    .append("text")
    .attr("fill", d => (highlight(d) ? "red" : null))
    .attr("dy", "0.31em")
    .attr("x", d => (d.children ? -6 : 6))
    .attr("text-anchor", d => (d.children ? "end" : "start"))
    .text(label)
    .clone(true)
    .lower()
    .attr("stroke", "white");

  return svg.node();
}

// --------------------------------------------------------------------------------------------------------------------

function collapsable_tree({ data: treeData, height, width, margin }) {
  const svg = d3
    .create("svg")
    .style("width", "100%")
    .style("height", height + 10 + "px")
    .style("overflow", "visible")
    .attr("text-anchor", "middle");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const nodeEnterSettings = (node, x, y) => {
    const nodeEnter = node
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", () => "translate(" + y + "," + x + ")")
      .on("click", function(d) {
        toggle(d);
        update(d);
      });

    nodeEnter
      .append("circle")
      .attr("r", 22)
      .style("fill", d => (d._children ? "lightsteelblue" : "#fff"))
      .style("fill-opacity", d => (d._children ? 1 : 0))
      .style("stroke", "white")
      .style("stroke-opacity", 0);

    // adds the image to the node
    nodeEnter
      .append("image")
      .attr("xlink:href", d => d.data.image)
      .attr("x", d => -16)
      .attr("y", d => -16)
      .attr("height", 35)
      .attr("width", 35);

    // adds the text to the node
    nodeEnter
      .append("text")
      .attr("x", d => (d.children ? -25 : 25))
      .attr("dy", ".35em")
      .style("text-anchor", d => (d.children ? "end" : "start"))
      .text(d => d.name);
    return nodeEnter;
  };

  const nodeExitSettings = (node, DURATION, x, y) => {
    const nodeExit = node
      .exit()
      .transition()
      .duration(DURATION)
      .attr("transform", d => "translate(" + y + "," + x + ")")
      .remove();

    nodeExit.select("circle").attr("r", 1e-6);

    nodeExit.select("text").style("fill-opacity", 1e-6);

    return nodeExit;
  };

  const nodeUpdateSettings = (nodeUpdate, DURATION) => {
    nodeUpdate
      .transition()
      .duration(DURATION)
      .attr("transform", d => `translate(${d.y},${d.x})`);

    nodeUpdate
      .select("circle")
      .attr("r", 22)
      .style("fill", d => (d._children ? "lightsteelblue" : "#fff"))
      .style("fill-opacity", d => (d._children ? 1 : 0))
      .style("stroke-opacity", 0);

    nodeUpdate.select("text").style("fill-opacity", 1);

    return nodeUpdate;
  };

  function collapse(node) {
    if (node.children) {
      node._children = node.children;
      node._children.forEach(collapse);
      node.children = null;
    }
  }

  function toggle(node) {
    if (node.children) {
      node._children = node.children;
      node.children = null;
    } else {
      node.children = node._children;
      node._children = null;
    }
    update(node);
  }

  const linkSettings = (treeData, DURATION, x, y) => {
    const link = g.selectAll(".link").data(treeData.links(), d => d.target.id);

    const linkEnter = link
      .enter()
      .insert("path", "g")
      .attr("class", "link")
      .attr(
        "d",
        d3
          .linkHorizontal()
          .x(d => y)
          .y(d => x)
      );

    const linkUpdate = linkEnter.merge(link);
    linkUpdate
      .transition()
      .duration(DURATION)
      .attr(
        "d",
        d3
          .linkHorizontal()
          .x(d => d.y)
          .y(d => d.x)
      );

    link
      .exit()
      .transition()
      .duration(DURATION)
      .attr(
        "d",
        d3
          .linkHorizontal()
          .x(() => y)
          .y(() => x)
      )
      .remove();
  };

  function update(source) {
    const tree = d3.tree().size([height, width]);

    tree(treeData);

    treeData.each(d => {
      d.y = d.depth * 180;
    });

    const node = g
      .selectAll(".node")
      .data(treeData.descendants(), d => d.id || (d.id = ++i));

    const ANIMATION_DURATION_MS = 500;
    const nodeEnter = nodeEnterSettings(node, source.x, source.y);

    nodeUpdateSettings(nodeEnter.merge(node), ANIMATION_DURATION_MS);
    nodeExitSettings(node, ANIMATION_DURATION_MS, source.x, source.y);

    linkSettings(treeData, ANIMATION_DURATION_MS, source.x, source.y);

    node.each(function(d) {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  treeData.children.forEach(collapse);
  update(treeData);

  return svg.node();
}

// --------------------------------------------------------------------------------------------------------------------

function circlepack_color({ data, height, width }) {
  const svg = d3
    .create("svg")
    .style("width", "100%")
    .style("height", height + "px")
    .style("font", "10px sans-serif");

  const pack = data =>
    d3
      .pack()
      .size([width, height])
      .padding(3)(
      d3
        .hierarchy(data)
        .sum(d => d.size)
        .sort((a, b) => b.size - a.size)
    );

  const root = pack(data);

  const node = svg
    .selectAll("g")
    .data(root.descendants())
    .enter()
    .append("g")
    .attr("transform", d => `translate(${d.x + 1},${d.y + 1})`);

  const color = d3.scaleSequential(d3.interpolateMagma).domain([8, 0]);

  node
    .append("circle")
    .attr("r", d => d.r)
    .attr("fill", d => color(d.height));

  const leaf = node.filter(d => !d.children);

  leaf
    .select("circle")
    .attr("id", d => (d.leafUid = DOM.uid("leaf")).id)
    .attr("stroke", "#000");

  leaf
    .append("clipPath")
    .attr("id", d => (d.clipUid = DOM.uid("clip")).id)
    .append("use")
    .attr("xlink:href", d => d.leafUid.href);

  leaf
    .append("text")
    .attr("clip-path", d => d.clipUid)
    .selectAll("tspan")
    .data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g))
    .enter()
    .append("tspan")
    .attr("x", 0)
    .attr("y", (d, i, nodes) => `${i - nodes.length / 2 + 0.8}em`)
    .text(d => d);

  node.append("title").text(
    d =>
      `${d
        .ancestors()
        .map(d => d.data.name)
        .reverse()
        .join("/")}\n${format(d.value)}`
  );

  return svg.node();
}

// --------------------------------------------------------------------------------------------------------------------

function zoomable_sunburst({ data, width = 1600, height = 1600 }) {
  const svg = d3
    .create("svg")
    .style("font", "10px sans-serif")
    .style("width", "100%")
    .style("height", height)
    .attr("text-anchor", "middle");

  const radius = width / 6;

  const arc = d3
    .arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius * 1.5)
    .innerRadius(d => d.y0 * radius)
    .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

  const partition = data => {
    const root = d3
      .hierarchy(data)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value);
    return d3.partition().size([2 * Math.PI, root.height + 1])(root);
  };

  const root = partition(data);

  const color = d3.scaleOrdinal(
    d3.quantize(d3.interpolateRainbow, data.children.length + 1)
  );

  root.each(d => (d.current = d));

  const g = svg
    .append("g")
    .attr("transform", `translate(${width / 2},${width / 2})`);

  const path = g
    .append("g")
    .selectAll("path")
    .data(root.descendants().slice(1))
    .join("path")
    .attr("fill", d => {
      while (d.depth > 1) d = d.parent;
      return color(d.data.name);
    })
    .attr("fill-opacity", d =>
      arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0
    )
    .attr("d", d => arc(d.current));

  path
    .filter(d => d.children)
    .style("cursor", "pointer")
    .on("click", clicked);

  path.append("title").text(
    d =>
      `${d
        .ancestors()
        .map(d => d.data.name)
        .reverse()
        .join("/")}\n${format(d.value)}`
  );

  const label = g
    .append("g")
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

  const parent = g
    .append("circle")
    .datum(root)
    .attr("r", radius)
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("click", clicked);

  function clicked(p) {
    parent.datum(p.parent || root);

    root.each(
      d =>
        (d.target = {
          x0:
            Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) *
            2 *
            Math.PI,
          x1:
            Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) *
            2 *
            Math.PI,
          y0: Math.max(0, d.y0 - p.depth),
          y1: Math.max(0, d.y1 - p.depth)
        })
    );

    const t = g.transition().duration(750);

    // Transition the data on all arcs, even the ones that aren’t visible,
    // so that if this transition is interrupted, entering arcs will start
    // the next transition from the desired position.
    path
      .transition(t)
      .tween("data", d => {
        const i = d3.interpolate(d.current, d.target);
        return t => (d.current = i(t));
      })
      .filter(function(d) {
        return +this.getAttribute("fill-opacity") || arcVisible(d.target);
      })
      .attr("fill-opacity", d =>
        arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0
      )
      .attrTween("d", d => () => arc(d.current));

    label
      .filter(function(d) {
        return +this.getAttribute("fill-opacity") || labelVisible(d.target);
      })
      .transition(t)
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
    const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
    const y = ((d.y0 + d.y1) / 2) * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }

  return svg.node();
}

// --------------------------------------------------------------------------------------------------------------------

function hierarchy_tree({ data, height, width }) {
  const svg = d3
    .create("svg")
    .attr("viewBox", [0, 0, width, height])
    .style("font", "10px sans-serif");

  const treemap = data =>
    d3
      .treemap()
      // .tile(d3.treemapBinary)
      // .tile(d3.treemapSliceDice)
      .tile(d3.treemapSquarify)
      .size([width, height])
      .padding(1)
      .round(true)(
      d3
        .hierarchy(data)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value)
    );
  const root = treemap(data);
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  const leaf = svg
    .selectAll("g")
    .data(root.leaves())
    .join("g")
    .attr("transform", d => `translate(${d.x0},${d.y0})`);

  leaf.append("title").text(
    d =>
      `${d
        .ancestors()
        .reverse()
        .map(d => d.data.name)
        .join("/")}\n${format(d.value)}`
  );

  leaf
    .append("rect")
    .attr("id", d => (d.leafUid = DOM.uid("leaf")).id)
    .attr("fill", d => {
      while (d.depth > 1) d = d.parent;
      return color(d.data.name);
    })
    .attr("fill-opacity", 0.6)
    .attr("width", d => d.x1 - d.x0)
    .attr("height", d => d.y1 - d.y0);

  leaf
    .append("clipPath")
    .attr("id", d => (d.clipUid = DOM.uid("clip")).id)
    .append("use")
    .attr("xlink:href", d => d.leafUid.href);

  leaf
    .append("text")
    .attr("clip-path", d => d.clipUid)
    .selectAll("tspan")
    .data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g).concat(format(d.value)))
    .join("tspan")
    .attr("x", 3)
    .attr(
      "y",
      (d, i, nodes) => `${(i === nodes.length - 1) * 0.3 + 1.1 + i * 0.9}em`
    )
    .attr("fill-opacity", (d, i, nodes) =>
      i === nodes.length - 1 ? 0.7 : null
    )
    .text(d => d);

  return svg.node();
}

