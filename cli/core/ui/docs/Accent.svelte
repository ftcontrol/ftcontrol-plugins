<script lang="ts">
  import { Snippet } from "svelte"

  let { children }: { children?: Snippet } = $props()
</script>

<span>{@render children?.()}</span>

<style>
  span {
    font-weight: 800;
  }
</style>
