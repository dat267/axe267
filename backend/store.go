package main

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
)

// NotificationStore persists notifications on behalf of a user email.
type NotificationStore interface {
	Create(ctx context.Context, userEmail string, notif Notification) (string, error)
	DeleteByEmail(ctx context.Context, userEmail string, limit int) (int, error)
}

type firestoreStore struct {
	db *firestore.Client
}

func (s *firestoreStore) Create(ctx context.Context, userEmail string, notif Notification) (string, error) {
	ref, _, err := s.db.Collection("notifications").Add(ctx, map[string]any{
		"userEmail": userEmail,
		"type":      notif.Type,
		"source":    notif.Source,
		"title":     notif.Title,
		"message":   notif.Message,
		"category":  notif.Category,
		"createdAt": time.Now(),
	})
	if err != nil {
		return "", fmt.Errorf("failed to create notification: %w", err)
	}
	return ref.ID, nil
}

// deleteInBatches invokes batchFn repeatedly until it returns fewer than
// limit documents, so that clearing a large collection is not capped by the
// Firestore 500-write-per-commit limit.
func deleteInBatches(ctx context.Context, limit int, batchFn func(context.Context, int) (int, error)) (int, error) {
	var total int
	for {
		n, err := batchFn(ctx, limit)
		if err != nil {
			return total, err
		}
		total += n
		if n < limit {
			return total, nil
		}
	}
}

func (s *firestoreStore) DeleteByEmail(ctx context.Context, userEmail string, limit int) (int, error) {
	return deleteInBatches(ctx, limit, func(ctx context.Context, batch int) (int, error) {
		return s.deleteBatchByEmail(ctx, userEmail, batch)
	})
}

func (s *firestoreStore) deleteBatchByEmail(ctx context.Context, userEmail string, limit int) (int, error) {
	iter := s.db.Collection("notifications").Where("userEmail", "==", userEmail).Limit(limit).Documents(ctx)
	var refs []*firestore.DocumentRef
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return 0, fmt.Errorf("failed to query notifications: %w", err)
		}
		refs = append(refs, doc.Ref)
	}
	if len(refs) == 0 {
		return 0, nil
	}
	batch := s.db.Batch()
	for _, ref := range refs {
		batch.Delete(ref)
	}
	if _, err := batch.Commit(ctx); err != nil {
		return 0, fmt.Errorf("failed to delete notifications: %w", err)
	}
	return len(refs), nil
}
