package phala

import (
	"fmt"
	"regexp"
	"strconv"
	"time"
)

type logTimeWindow struct {
	Since *int64
	Until *int64
}

var rfc3339Re = regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$`)
var relativeRe = regexp.MustCompile(`^(\d+)([smhd])$`)

func resolveLogTimeWindow(since any, until any, now time.Time) (logTimeWindow, error) {
	var out logTimeWindow
	if since != nil {
		v, err := parseLogTime(since, now, false)
		if err != nil {
			return out, err
		}
		out.Since = &v
	}
	if until != nil {
		v, err := parseLogTime(until, now, true)
		if err != nil {
			return out, err
		}
		out.Until = &v
	}
	return out, nil
}

func parseLogTime(value any, now time.Time, ceil bool) (int64, error) {
	switch v := value.(type) {
	case int:
		return int64(v), nil
	case int64:
		return v, nil
	case string:
		if v == "" {
			return 0, fmt.Errorf("phala: empty log time")
		}
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n, nil
		}
		if m := relativeRe.FindStringSubmatch(v); m != nil {
			n, _ := strconv.ParseInt(m[1], 10, 64)
			var d time.Duration
			switch m[2] {
			case "s":
				d = time.Duration(n) * time.Second
			case "m":
				d = time.Duration(n) * time.Minute
			case "h":
				d = time.Duration(n) * time.Hour
			case "d":
				d = time.Duration(n) * 24 * time.Hour
			}
			sec := now.Add(-d).Unix()
			return sec, nil
		}
		if rfc3339Re.MatchString(v) {
			t, err := time.Parse(time.RFC3339Nano, v)
			if err != nil {
				t, err = time.Parse(time.RFC3339, v)
				if err != nil {
					return 0, fmt.Errorf("phala: invalid log time %q", v)
				}
			}
			if ceil {
				nsec := t.Unix()
				if t.UnixNano()%1e9 != 0 {
					nsec++
				}
				return nsec, nil
			}
			return t.Unix(), nil
		}
		return 0, fmt.Errorf("phala: invalid log time %q", v)
	default:
		return 0, fmt.Errorf("phala: invalid log time %v", value)
	}
}
