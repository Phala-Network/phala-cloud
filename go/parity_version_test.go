package phala

import (
	"context"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

func TestEveryLegacyMethodPinsVersion(t *testing.T) {
	var got string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Get("X-Phala-Version")
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer server.Close()
	c, _ := NewClient(WithAPIKey("key"), WithBaseURL(server.URL), WithAPIVersion("2026-06-23"), WithHeader("x-phala-version", "override"), WithMaxRetries(0))
	v := reflect.ValueOf(c)
	count := 0
	for i := 0; i < v.NumMethod(); i++ {
		method := v.Type().Method(i)
		if !strings.HasSuffix(method.Name, "V20260121") {
			continue
		}
		count++
		t.Run(method.Name, func(t *testing.T) {
			fn := v.Method(i)
			typ := fn.Type()
			args := []reflect.Value{reflect.ValueOf(context.Background())}
			for j := 1; j < typ.NumIn(); j++ {
				p := typ.In(j)
				switch p.Kind() {
				case reflect.String:
					args = append(args, reflect.ValueOf("id"))
				case reflect.Pointer:
					args = append(args, reflect.New(p.Elem()))
				default:
					t.Fatalf("unsupported argument %v", p)
				}
			}
			got = ""
			fn.Call(args)
			if got != "2026-01-21" {
				t.Fatalf("version header %q", got)
			}
		})
	}
	if count == 0 {
		t.Fatal("no legacy methods tested")
	}
	got = ""
	_, _ = c.GetCVMInfo(context.Background(), "id")
	if got != "override" {
		t.Fatalf("legacy request changed ordinary version: %q", got)
	}
}
