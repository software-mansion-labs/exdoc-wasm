defmodule ExDoc.Markdown.CodeBlock do
  @spec process(code :: String) :: {input :: String, output :: String}
  def process(code) do
    case split_input_output(code) do
      {inputs, ""} -> [inputs: inputs]
      {[], output} -> [output: output]
      {inputs, output} -> [inputs: inputs, output: output]
    end
  end

  defp split_input_output(code) do
    [output | reversed] =
      code
      |> String.split("\n", trim: true)
      |> collapse_multiline()

    {Enum.reverse(reversed), output}
  end

  def collapse_multiline(code), do: collapse_multiline(code, [])

  def collapse_multiline([], fragments), do: fragments

  def collapse_multiline(["iex> " <> line | rest], fragments) do
    collapse_multiline(rest, [line | fragments])
  end

  def collapse_multiline(["...> " <> cont | rest], [prev | fragments]) do
    prev_fragment = prev <> "\n" <> cont
    collapse_multiline(rest, [prev_fragment | fragments])
  end

  def collapse_multiline(output, fragments), do: [Enum.join(output, "\n") | fragments]
end

"""
iex> enum = 1001..9999
iex> n = 3
iex> stream = Stream.transform(enum, 0, fn i, acc ->
...>   if acc < n, do: {[i], acc + 1}, else: {:halt, acc}
...> end)
iex> stream = Stream.transform(enum, 0, fn i, acc ->
...>   if acc < n, do: {[i], acc + 1}, else: {:halt, acc}
...> end)
iex> Enum.to_list(stream)
[1001, 1002, 1003]
"""
