def has_null_variant:
  (type == "array") and (map((.type? // "") == "null") | any);

def non_null_variant:
  [ .[] | select((.type? // "") != "null") ];

def fixnode:
  if type == "object" then
    (
      if .type? == "null" then
        del(.type) | .nullable = true
      else
        .
      end
    )
    |
    (
      if (.type? | type) == "array" and (.type | index("null")) != null then
        .type = ((.type - ["null"])[0] // .type) | .nullable = true
      else
        .
      end
    )
    |
    (
      if (.anyOf? | has_null_variant) then
        . as $o
        | ($o.anyOf | non_null_variant) as $nn
        | if ($nn | length) == 1 then
            ($o | del(.anyOf) + $nn[0] + {nullable: true})
          else
            .anyOf = $nn | .nullable = true
          end
      else
        .
      end
    )
    |
    (
      if (.oneOf? | has_null_variant) then
        . as $o
        | ($o.oneOf | non_null_variant) as $nn
        | if ($nn | length) == 1 then
            ($o | del(.oneOf) + $nn[0] + {nullable: true})
          else
            .oneOf = $nn | .nullable = true
          end
      else
        .
      end
    )
    |
    with_entries(.value |= fixnode)
  elif type == "array" then
    map(fixnode)
  else
    .
  end;

fixnode | .openapi = "3.0.3"
