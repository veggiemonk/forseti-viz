package main

import (
	"database/sql"
	"fmt"
	"github.com/rs/cors"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"text/template"

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
	db         *sql.DB
	javaScript []byte

	port           = os.Getenv("PORT")
	connectionName = os.Getenv("MYSQL_INSTANCE_CONNECTION_NAME")
	dbUser         = os.Getenv("MYSQL_USER")
	dbPassword     = os.Getenv("MYSQL_PASSWORD")
	dsn            = fmt.Sprintf("%s:%s@unix(/cloudsql/%s)/forseti_security", dbUser, dbPassword, connectionName)
	t              = template.Must(template.ParseFiles("index.html"))
	jsFile         = "index.js"
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

	javaScript, err = ioutil.ReadFile(jsFile)
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

// RenderForseti returns the HTML page with the data from the Forseti database
func RenderForseti(w http.ResponseWriter, r *http.Request) {

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

	data := struct {
		Data       string
		JavaScript string
	}{
		Data: payload.String(),
		//JavaScript: fmt.Sprintf("<script>%s</script>", string(javaScript)),
		JavaScript: string(javaScript),
	}
	err = t.Execute(w, data)
	if err != nil {
		log.Printf("ExecuteTemplate: %v", err)
		http.Error(w, "Error rendering template", http.StatusInternalServerError)
		return
	}
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	fmt.Println("checking...")

	err := db.Ping()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Println(err)
	}
	_, err = io.WriteString(w, err.Error()+"\n")
	if err != nil {
		fmt.Println(err)
	}
}
func main() {
	fmt.Println("Starting...")
	ex, err := os.Executable()
	if err != nil {
		panic(err)
	}
	exPath := filepath.Dir(ex)
	fmt.Printf("Execution path: %s\n", exPath)

	// Closing signal
	stopCh := make(chan os.Signal, 1)
	signal.Notify(stopCh,
		syscall.SIGKILL,
		syscall.SIGINT,
		syscall.SIGTERM,
		syscall.SIGQUIT,
	)

	if port == "" {
		port = "8080"
	}
	fmt.Println("open http://localhost:" + port)

	sm := http.NewServeMux()
	fs := http.FileServer(http.Dir(exPath))
	sm.Handle("/icons/", http.StripPrefix("/", fs))
	sm.HandleFunc("/", RenderForseti)
	sm.HandleFunc("/data", ExtractCSV)
	sm.HandleFunc("/healthz", healthCheck)

	//cors.Default() setup the middleware with default options being
	// all origins accepted with simple methods (GET, POST). See
	// documentation below for more options. https://github.com/rs/cors
	handler := cors.Default().Handler(sm)
	go func() {
		fmt.Println("listening...")
		if err := http.ListenAndServe(":"+port, handler); err != nil {
			log.Fatal(err)
		}
	}()

	fmt.Println("waiting for signal...")
	// Shutdown
	<-stopCh
	defer close(stopCh)
	fmt.Println("Stopping...")
}
