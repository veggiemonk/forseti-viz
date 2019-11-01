package function

import (
	"database/sql"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"

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
	dsn            = fmt.Sprintf("%s:%s@unix(/cloudsql/%s)/forseti_security", dbUser, dbPassword, connectionName)
	query          = `
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

	//dsn = fmt.Sprintf("%s:%s@tcp(%s)/forseti_security", dbUser, dbPassword, connectionName)
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
	rows, err := db.Query(query)
	if err != nil {
		log.Printf("db.Query: %v", err)
		http.Error(w, "Error querying database", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	payload := make([]byte, 0)
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

		payload = append(payload, []byte(fmt.Sprintf("%d,%s,%s,%s,%d,%s,%s\n",
			data.ID,
			data.ResourceType,
			data.Category,
			data.ResourceID,
			data.ParentID,
			data.ResourceDisplayName,
			data.ResourceName,
		))...)
	}

	w.Header().Add("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write(payload)
}

// HelloHTTP is an HTTP Cloud Function with a request parameter.
func HelloHTTP(w http.ResponseWriter, r *http.Request) {

	h, err := ioutil.ReadFile("index.html")
	if err != nil {
		_, _ = fmt.Fprintf(w, "Error reading file")
		return
	}
	_, _ = io.WriteString(w, string(h))
}
