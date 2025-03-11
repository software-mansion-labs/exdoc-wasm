defmodule ExDoc.Formatter.HTML.Assets do
  @moduledoc false

  defmacrop embed_pattern(pattern) do
    ["formatters/html", pattern]
    |> Path.join()
    |> Path.wildcard()
    |> Enum.map(fn path ->
      IO.inspect(path)
      Module.put_attribute(__CALLER__.module, :external_resource, path)
      {Path.basename(path), File.read!(path)}
    end)
  end

  defp dist_avm_bundle(), do: embed_pattern("dist/eval.avm")
  defp dist_wasm(), do: embed_pattern("dist/AtomVM.wasm")
  defp dist_avm_js(), do: embed_pattern("dist/AtomVM.js")
  defp dist_avm_eval_js(), do: embed_pattern("dist/avm-eval.js")
  defp dist_js(), do: embed_pattern("dist/html-*.js")
  defp dist_inline_js(), do: embed_pattern("dist/inline_html-*.js")
  defp dist_css(:elixir), do: embed_pattern("dist/html-elixir-*.css")
  defp dist_css(:erlang), do: embed_pattern("dist/html-erlang-*.css")
  defp dist_license(), do: embed_pattern("dist/*.LICENSE.txt")

  ## Assets

  def dist(proglang) do
    dist_js() ++
      dist_wasm() ++ dist_avm_bundle() ++ dist_avm_js() ++ dist_avm_eval_js() ++ dist_css(proglang) ++ dist_license()
  end

  def fonts, do: embed_pattern("dist/*.woff2")

  ## Sources

  def inline_js_source(), do: dist_inline_js() |> extract_source!()

  ## Filenames

  def js_filename(), do: dist_js() |> extract_filename!()
  def avm_eval_js_filename(), do: dist_avm_eval_js() |> extract_filename!()
  def avm_bundle_filename(), do: dist_avm_bundle() |> extract_filename!()
  def avm_js_filename(), do: dist_avm_js() |> extract_filename!()
  def css_filename(language), do: dist_css(language) |> extract_filename!()

  ## Helpers

  @doc """
  Some assets are generated automatically, so we find the revision at runtime.
  """
  def rev(output, pattern) do
    output = Path.expand(output)

    matches =
      output
      |> Path.join(pattern)
      |> Path.wildcard()

    case matches do
      [] -> raise("could not find matching #{output}/#{pattern}")
      [asset | _] -> Path.relative_to(asset, output)
    end
  end

  defp extract_filename!([{location, _}]), do: location
  defp extract_source!([{_, source}]), do: source
end
