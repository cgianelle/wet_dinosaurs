// Command dsseating seats students with a genetic algorithm.
package main

import (
	"os"

	"dsseating/internal/cli"
)

func main() {
	os.Exit(cli.Run(os.Args[1:], os.Stdout, os.Stderr))
}
