package main

import (
	"context"
	"errors"
	"testing"
)

func TestDeleteInBatchesLoopsUntilEmpty(t *testing.T) {
	// Simulate a collection with 1200 docs and a batch size of 500.
	remaining := 1200
	batchFn := func(_ context.Context, limit int) (int, error) {
		if remaining == 0 {
			return 0, nil
		}
		n := limit
		if remaining < limit {
			n = remaining
		}
		remaining -= n
		return n, nil
	}

	total, err := deleteInBatches(context.Background(), 500, batchFn)
	if err != nil {
		t.Fatalf("deleteInBatches returned error: %v", err)
	}
	if total != 1200 {
		t.Fatalf("total deleted = %d, want 1200", total)
	}
	if remaining != 0 {
		t.Fatalf("remaining = %d, want 0 (loop stopped early)", remaining)
	}
}

func TestDeleteInBatchesStopsOnPartialBatch(t *testing.T) {
	var calls int
	batchFn := func(_ context.Context, limit int) (int, error) {
		calls++
		if calls == 1 {
			return 500, nil // full batch, must loop again
		}
		return 200, nil // partial batch, loop must stop
	}
	total, err := deleteInBatches(context.Background(), 500, batchFn)
	if err != nil {
		t.Fatalf("deleteInBatches returned error: %v", err)
	}
	if total != 700 {
		t.Fatalf("total deleted = %d, want 700", total)
	}
	if calls != 2 {
		t.Fatalf("batchFn called %d times, want 2", calls)
	}
}

func TestDeleteInBatchesStopsImmediatelyOnFirstPartialBatch(t *testing.T) {
	var calls int
	batchFn := func(_ context.Context, limit int) (int, error) {
		calls++
		return 200, nil // fewer than limit, no more docs
	}
	total, err := deleteInBatches(context.Background(), 500, batchFn)
	if err != nil {
		t.Fatalf("deleteInBatches returned error: %v", err)
	}
	if total != 200 {
		t.Fatalf("total deleted = %d, want 200", total)
	}
	if calls != 1 {
		t.Fatalf("batchFn called %d times, want 1", calls)
	}
}

func TestDeleteInBatchesPropagatesError(t *testing.T) {
	batchFn := func(_ context.Context, limit int) (int, error) {
		return 0, errors.New("commit failed")
	}
	_, err := deleteInBatches(context.Background(), 500, batchFn)
	if err == nil {
		t.Fatal("expected error to propagate, got nil")
	}
}
