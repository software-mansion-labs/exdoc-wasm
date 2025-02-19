defmodule ExDoc.Markdown.CodeBlock do
  @spec process(code :: String) :: {input :: String, output :: String}
  def process(code) do
    case split_input_output(code) do
      {input, ""} -> %{input: input}
      {"", output} -> %{output: output}
      {input, output} -> %{input: input, output: output}
    end
  end

  defp split_input_output(code) do
    code
    |> String.split("\n")
    |> Enum.map(&String.trim/1)
    |> Enum.reduce({"", ""}, fn
      "iex> " <> line, {input, output} -> {input <> line <> "\n", output}
      "...> " <> line, {input, output} -> {input <> line <> "\n", output}
      line, {input, output} -> {input, output <> line <> "\n"}
    end)
  end
end

"""
iex> case {1, 2, 3} do
...>   {4, 5, 6} ->
...>     "This clause won't match"
...>   {1, x, 3} ->
...>     "This clause will match and bind x to 2 in this clause"
...>   _ ->
...>     "This clause would match any value"
...> end
"This clause will match and bind x to 2 in this clause"
"""
