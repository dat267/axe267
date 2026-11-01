package main

import (
	"context"
	"net"
	"net/http"
	"testing"
	"time"
)

func TestServeHTTPDrainsInFlightRequests(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	started := make(chan struct{})
	release := make(chan struct{})
	released := false
	releaseHandler := func() {
		if !released {
			released = true
			close(release)
		}
	}
	t.Cleanup(func() {
		releaseHandler()
		listener.Close()
	})

	server := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			close(started)
			<-release
			w.WriteHeader(http.StatusOK)
		}),
	}
	shutdownStarted := make(chan struct{})
	server.RegisterOnShutdown(func() {
		close(shutdownStarted)
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	returned := make(chan error, 1)
	go func() {
		returned <- serveHTTP(ctx, server, listener)
	}()

	type result struct {
		status int
		err    error
	}
	requestDone := make(chan result, 1)
	go func() {
		resp, err := http.Get("http://" + listener.Addr().String())
		if err != nil {
			requestDone <- result{err: err}
			return
		}
		defer resp.Body.Close()
		requestDone <- result{status: resp.StatusCode}
	}()

	<-started
	cancel()

	select {
	case <-shutdownStarted:
	case err := <-returned:
		t.Fatalf("serveHTTP returned before draining in-flight request: %v", err)
	case <-time.After(time.Second):
		t.Fatal("serveHTTP did not start graceful shutdown")
	}

	select {
	case err := <-returned:
		t.Fatalf("serveHTTP returned while the handler was still running: %v", err)
	default:
	}

	releaseHandler()

	got := <-requestDone
	if got.err != nil {
		t.Fatalf("in-flight request failed: %v", got.err)
	}
	if got.status != http.StatusOK {
		t.Fatalf("in-flight request status = %d, want 200", got.status)
	}

	select {
	case err := <-returned:
		if err != nil {
			t.Fatalf("serveHTTP returned error after shutdown: %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("serveHTTP did not finish after the handler completed")
	}
}
