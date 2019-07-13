package main

import (
	"fmt"
	"github.com/veggiemonk/forseti-viz/function"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

func main() {

	fmt.Println("Starting...")

	ex, err := os.Executable()
	if err != nil {
		panic(err)
	}
	exPath := filepath.Dir(ex)
	fmt.Println(exPath)

	fs := http.FileServer(http.Dir(exPath))
	http.Handle("/icons/", http.StripPrefix("/", fs))

	http.HandleFunc("/", function.RenderForseti)
	http.HandleFunc("/data", function.ExtractCSV)

	log.Fatal(http.ListenAndServe(":8080", nil))
}