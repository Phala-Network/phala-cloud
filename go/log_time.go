package phala

import (
	"math"
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
			return 0, errLogValidation("empty log time")
		}
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n, nil
		}
		if m := relativeRe.FindStringSubmatch(v); m != nil {
			n, err := strconv.ParseInt(m[1], 10, 64)
			if err != nil {
				return 0, errLogValidation("invalid log time %q", v)
			}
			var unit time.Duration
			switch m[2] {
			case "s":
				unit = time.Second
			case "m":
				unit = time.Minute
			case "h":
				unit = time.Hour
			case "d":
				unit = 24 * time.Hour
			default:
				return 0, errLogValidation("invalid log time %q", v)
			}
			if n > 0 && uint64(n) > uint64(math.MaxInt64)/uint64(unit) {
				return 0, errLogValidation("log time %q overflows", v)
			}
			d := time.Duration(n) * unit
			t := now.Add(-d)
			if ceil {
				sec := t.Unix()
				if t.Nanosecond() != 0 {
					sec++
				}
				return sec, nil
			}
			return t.Unix(), nil
		}
		if rfc3339Re.MatchString(v) {
			t, err := time.Parse(time.RFC3339Nano, v)
			if err != nil {
				t, err = time.Parse(time.RFC3339, v)
				if err != nil {
					return 0, errLogValidation("invalid log time %q", v)
				}
			}
			if ceil {
				nsec := t.Unix()
				if t.Nanosecond() != 0 {
					nsec++
				}
				return nsec, nil
			}
			return t.Unix(), nil
		}
		return 0, errLogValidation("invalid log time %q", v)
	default:
		return 0, errLogValidation("invalid log time %v", value)
	}
}
