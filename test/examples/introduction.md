## Examples

- IO
- errors
- modules

```live-elixir
iex> case {1, 2, 3} do
...>   {4, 5, 6} ->
...>     "This clause won't match"
...>   {1, x, 3} ->
...>     "This clause will match and bind x to 2 in this clause"
...>   _ ->
...>     "This clause would match any value"
...> end
# "This clause will match and bind x to 2 in this clause"
```

```live-elixir
iex> IO.puts("Hello world from Elixir")
# :ok
```

```live-elixir
iex> hd(1)
iex> case 1 do
...>   x when hd(x) -> "Won't match"
...>   x -> "Got #{x}"
...> end
# ** (ArgumentError) argument error
```

```live-elixir
iex> enum = 1001..9999
iex> n = 3
iex> stream = Stream.transform(enum, 0, fn i, acc ->
...>   if acc < n, do: {[i], acc + 1}, else: {:halt, acc}
...> end)
iex> stream = Stream.transform(enum, 0, fn i, acc ->
...>   if acc < n, do: {[i], acc + 1}, else: {:halt, acc}
...> end)
iex> Enum.to_list(stream)
# [
# 	1001,
# 	1002,
# 	1003
# ]
```
