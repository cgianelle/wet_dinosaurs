// Command dsseating-server serves the seating API and, with -static, the built web app.
package main

import (
	"flag"
	"log/slog"
	"os"

	"dsseating/internal/api"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	static := flag.String("static", "", "directory of built web assets to serve (optional)")
	flag.Parse()
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	logger.Info("listening", "addr", *addr, "static", *static != "")
	if err := api.ListenAndServe(*addr, api.New(api.Config{StaticDir: *static, Logger: logger})); err != nil {
		logger.Error("server stopped", "error", err.Error())
		os.Exit(1)
	}
}
