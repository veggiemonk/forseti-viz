package function

import (
	"database/sql"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"strings"

	_ "github.com/go-sql-driver/mysql"
)

// Node is a node for the csv structure
type Node struct {
	ID                  int    `json:"id"`
	ResourceType        string `json:"resource_type"`
	Category            string `json:"category"`
	ResourceID          string `json:"resource_id"`
	ParentID            int    `json:"parent_id"`
	ResourceDisplayName string `json:"resource_data_displayname"`
	ResourceName        string `json:"resource_data_name"`
}

var (
	db *sql.DB

	connectionName = os.Getenv("MYSQL_INSTANCE_CONNECTION_NAME")
	dbUser         = os.Getenv("MYSQL_USER")
	dbPassword     = os.Getenv("MYSQL_PASSWORD")
	//dsn            = fmt.Sprintf("%s:%s@unix(/cloudsql/%s)/", dbUser, dbPassword, connectionName)
	dsn            = fmt.Sprintf("%s:%s@tcp(%s)/forseti_security", dbUser, dbPassword, connectionName)

	query = `
SELECT  id,
		resource_type,
		category,
		resource_id,
		IFNULL(parent_id, 0) as parent_id,
		IFNULL(resource_data ->> '$.displayName', '') as resource_data_displayname,
		IFNULL(resource_data ->> '$.name', '')        as resource_data_name
FROM gcp_inventory
WHERE inventory_index_id = (SELECT id FROM inventory_index ORDER BY completed_at_datetime DESC LIMIT 1)
  AND (category = 'resource')
  AND (resource_type = 'organization' OR resource_type = 'project' OR resource_type = 'folder' OR
       resource_type = 'appengine_app' OR resource_type = 'kubernetes_cluster' OR resource_type = 'cloudsqlinstance' OR
       resource_type = 'instance' OR resource_type = 'instance_group' OR resource_type = 'instancetemplate' OR
       resource_type = 'disk' OR resource_type = 'bucket'
  	   )`

	tpl = `
<!DOCTYPE html>
<meta charset="utf-8">
<style>
  /* set the CSS */

  .node circle {
    fill: #fff;
    stroke: steelblue;
    stroke-width: 3px;
  }

  .node text {
    font: 12px sans-serif;
  }

  .node--internal text {
    text-shadow: 0 1px 0 #fff, 0 -1px 0 #fff, 1px 0 0 #fff, -1px 0 0 #fff;
  }

  .link {
    fill: none;
    stroke: #ccc;
    stroke-width: 2px;
  }
</style>

<body>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/5.9.7/d3.min.js" integrity="sha256-D+2/goqcjnuoryb9A0rifuH0rBYS9hKOzNqG91JhAVc=" crossorigin="anonymous"></script>
  <script>
const csv_data = {{.}}

// set the dimensions and margins of the diagram
const margin = { top: 40, right: 45, bottom: 30, left: 150 };

// Use the parsed tree data to dynamically create height & width
const width = 1500 - margin.left - margin.right,
  height = 3600 - margin.top - margin.bottom;

// FUNCTIONS
const tree = d3.tree().size([height, width]);
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
  image: getImageURL(d[1])
});

// DOM
const svg = d3
  .select("body")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom);

const g = svg
  .append("g")
  .attr("transform", "translate("+margin.left+","+margin.top+")");

// UPDATE

const nodeEnterSettings = (node, x, y) => {
  const nodeEnter = node
    .enter()
    .append("g")
    .attr("class", "node")
    .attr("transform", () => "translate("+ y +","+ x +")")
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
    .attr("transform", d => "translate("+ y +","+ x +")")
    .remove();

  nodeExit.select("circle").attr("r", 1e-6);

  nodeExit.select("text").style("fill-opacity", 1e-6);

  return nodeExit;
};

const nodeUpdateSettings = (nodeUpdate, DURATION) => {
  nodeUpdate
    .transition()
    .duration(DURATION)
    .attr("transform", d => "translate(" + d.y + "," + d.x + ")" );

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

// Toggle children on click.
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

function getImageURL(resource_type) {
  // const URL_BASE = "https://storage.googleapis.com/mps-storage/mzinni/external/gcp-arch-viz-images/";
  const URL_BASE = "icons/";
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

let treeData;

function update(source) {
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

function main() {

console.log({csv_data});
  const table = d3.csvParseRows(csv_data, parse_row);
  treeData = stratify(table);
  treeData.each(d => {
    d.name = d.data.resource_name;
  });
  treeData.children.forEach(collapse);
  update(treeData);
}

main();

  </script>
</body>`


)


func init() {
	var err error
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Could not open db: %v", err)
	}

	// Only allow 1 connection to the database to avoid overloading it.
	db.SetMaxIdleConns(1)
	db.SetMaxOpenConns(1)
}

// ExtractCSV extracts the data from Forseti database.
func ExtractCSV(w http.ResponseWriter, r *http.Request) {

	t, err := template.New("forseti-viz").Parse(tpl)

	rows, err := db.Query(query)
	if err != nil {
		log.Printf("db.Query: %v", err)
		http.Error(w, "Error querying database", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	//payload := make([]byte, 0)
	var payload strings.Builder
	for rows.Next() {
		data := new(Node)

		err := rows.Scan(
			&data.ID,
			&data.ResourceType,
			&data.Category,
			&data.ResourceID,
			&data.ParentID,
			&data.ResourceDisplayName,
			&data.ResourceName,
		)
		if err != nil {
			log.Printf("rows.Scan: %v", err)
			http.Error(w, "Error scanning database", http.StatusInternalServerError)
			return
		}

		payload.WriteString(fmt.Sprintf("%d,%s,%s,%s,%d,%s,%s\n",
			data.ID,
			data.ResourceType,
			data.Category,
			data.ResourceID,
			data.ParentID,
			data.ResourceDisplayName,
			data.ResourceName,
		))
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	//w.Header().Add("Content-Type", "text/plain")

	err = t.Execute(w, payload.String())
	if err != nil {
		log.Printf("ExecuteTemplate: %v", err)
		http.Error(w, "Error rendering template", http.StatusInternalServerError)
		return
	}

	//_, _ = w.Write(payload)
	//fmt.Fprintf(w, "%s", payload)

}
