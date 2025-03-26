import io

import streamlit as st

from streamlit_layoutr import streamlit_layoutr

st.set_page_config(layout="wide")

with st.sidebar:
    hovered = st.empty()
    selected = st.empty()
    graph_string = '{"nodes": [], "links": []}'
    uploaded_file = st.file_uploader("Choose a file")
    if uploaded_file is not None:
        graph_string = io.StringIO(uploaded_file.getvalue().decode("utf-8")).read()

    run_layout = st.toggle("Run layout", False)
    node_size = st.slider("Node size", 0.0, 0.5, 0.15, 0.01)
    node_size_field = st.selectbox("Node size field", options=["degree", None])
    node_color_field = st.selectbox("Node color field", options=["type", None])
    node_color_mode = st.selectbox("Node color mode", options=["auto", "identity"])
    node_opacity = st.slider("Node opacity", 0.0, 1.0, 1.0, 0.01)
    node_stroke_width = st.slider("Node stroke width", 0.0, 10.0, 1.0, 0.01)
    node_stroke_opacity = st.slider("Node stroke opacity", 0.0, 1.0, 1.0, 0.01)
    link_width = st.slider("Link width", 0.0, 10.0, 2.0, 0.01)
    link_opacity = st.slider("Link opacity", 0.0, 1.0, 0.05, 0.01)

    energy = st.slider("Energy", 0.0, 1.0, 1.0, 0.01)
    collide_strength = st.slider("Collide strength", 0.0, 1.0, 1.0, 0.01)
    charge_strength = st.slider("Charge strength", 0.0, 1.0, 1.0, 0.01)
    charge_approximation = st.slider("Charge approximation", 0.0, 1.0, 1.0, 0.01)
    link_strength = st.slider("Link strength", 0.0, 1.0, 0.1, 0.01)
    gravity_strength = st.slider("Gravity strength", 0.0, 1.0, 0.0, 0.01)
    center_strength = st.slider("Center strength", 0.0, 1.0, 1.0, 0.01)

output = streamlit_layoutr(
    graph=graph_string,
    run_layout=run_layout,
    node_size=node_size,
    node_size_field=node_size_field,
    node_color_field=node_color_field,
    node_color_mode=node_color_mode,
    node_opacity=node_opacity,
    node_stroke_width=node_stroke_width,
    node_stroke_opacity=node_stroke_opacity,
    link_width=link_width,
    link_opacity=link_opacity,
    energy=energy,
    collide_strength=collide_strength,
    charge_strength=charge_strength,
    charge_approximation=charge_approximation,
    link_strength=link_strength,
    gravity_strength=gravity_strength,
    center_strength=center_strength,
    key="a",
)

node = output.get("hovered")
if node:
    hovered.markdown(f"Hovered node: {node.get('id')}, Type: {node.get('type')}")

select = output.get("selected")
if select:
    selected.markdown(f"Selected node: {select.get('id')}, Type: {select.get('type')}")
