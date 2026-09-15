package repository

import "testing"

func TestSQLiteDSNAddsConcurrencyPragmas(t *testing.T) {
	got := sqliteDSN("data/infinite-canvas.db")
	want := "data/infinite-canvas.db?_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)"
	if got != want {
		t.Fatalf("sqliteDSN() = %q, want %q", got, want)
	}
}

func TestSQLiteDSNPreservesExistingQueryAndPragmas(t *testing.T) {
	input := "file:data.db?cache=shared&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	if got := sqliteDSN(input); got != input {
		t.Fatalf("sqliteDSN() = %q, want unchanged %q", got, input)
	}
}
