<script lang="ts">
  import type { Snippet } from "svelte"

  let {
    disabled = false,
    transparent = false,
    selected = false,
    onclick = () => {},
    children,
    style = "",
  }: {
    disabled?: boolean
    transparent?: boolean
    selected?: boolean
    onclick?: () => void
    children: Snippet
    style?: string
  } = $props()
</script>

<button {disabled} class:transparent class:selected {onclick} {style}>
  {@render children()}
</button>

<style>
  button {
    border: none;
    margin: 0;
    background-color: var(--bgLight);
    color: var(--text);
    padding: 1em 2em;
    border-radius: 10px;
    cursor: pointer;
    flex-grow: 1;

    justify-content: center;
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
  }

  button.transparent {
    background-color: transparent;
    padding: 0;
  }

  button.selected {
    font-weight: 700;
  }

  button:disabled {
    opacity: 0.5;
  }
</style>
