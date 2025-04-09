import os

import streamlit.components.v1 as components

_RELEASE = True

if not _RELEASE:
    _component_func = components.declare_component(
        "streamlit_layoutr",
        url="http://localhost:5173",
    )
else:
    parent_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(parent_dir, "frontend/dist")
    _component_func = components.declare_component("streamlit_layoutr", path=build_dir)


def streamlit_layoutr(
    graph=None,
    run_layout=False,
    node_size=1,
    node_size_field=None,
    node_color_field=None,
    node_color_mode="auto",
    node_opacity=1,
    node_stroke_width=1,
    node_stroke_opacity=1,
    node_label_field=None,
    node_label_font_size=12,
    node_label_max_count=100,
    link_width=1,
    link_opacity=1,
    energy=1,
    collide_strength=1,
    charge_strength=1,
    charge_approximation=1,
    link_strength=1,
    gravity_strength=0,
    center_strength=1,
    key=None,
):
    """Create a new instance of "streamlit_layoutr".

    Parameters
    ----------
    graph: str
        The graph data in string format to be processed by the component.
    run_layout: bool
        A flag indicating whether to run the layout.
    link_strength: float
        A value representing the strength of the links in the graph.
    node_size: float
        A value representing the node size.
    key: str or None
        An optional key that uniquely identifies this component. If this is
        None, and the component's arguments are changed, the component will
        be re-mounted in the Streamlit frontend and lose its current state.
    """
    component_value = _component_func(
        graph=graph,
        run_layout=run_layout,
        node_size=node_size,
        node_size_field=node_size_field,
        node_color_field=node_color_field,
        node_color_mode=node_color_mode,
        node_opacity=node_opacity,
        node_stroke_width=node_stroke_width,
        node_stroke_opacity=node_stroke_opacity,
        node_label_field=node_label_field,
        node_label_font_size=node_label_font_size,
        node_label_max_count=node_label_max_count,
        link_width=link_width,
        link_opacity=link_opacity,
        energy=energy,
        collide_strength=collide_strength,
        charge_strength=charge_strength,
        charge_approximation=charge_approximation,
        link_strength=link_strength,
        gravity_strength=gravity_strength,
        center_strength=center_strength,
        key=key,
        default=dict(fields=[]),
    )

    return component_value
