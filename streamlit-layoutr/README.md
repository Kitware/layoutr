# Streamlit Layoutr Component

A Streamlit Component for Layoutr based on a template for creating Streamlit Components. It uses Vue 3 to code the frontend and Vite to serve the files locally during development, as well as bundle and compile them for production.

This repo contains templates and example code for creating [Streamlit](https://streamlit.io) Components. For complete information, please see the [Streamlit Components documentation](https://docs.streamlit.io/en/latest/streamlit_components.html)!

## Development

To develop the component, you need to have Node.js and npm installed. You can download them from [nodejs.org](https://nodejs.org/).

1. Go to the `frontend` directory and initialize and run the component template frontend:
``` bash
cd streamlit_layoutr/frontend
```
``` bash
npm install
npm run dev
```

1. Set `_RELEASE = False` in `streamlit_layoutr/__init__.py`. This will pull the component live from `npm run dev` instead of the built version.

1. From a separate terminal, go to the repository root directory, create a new Python virtual environment, activate it and install Streamlit and the template as an editable package:
``` bash
python3 -m venv venv
. venv/bin/activate
pip install streamlit
pip install -e .
```

1. Still from the same separate terminal, run the example Streamlit app:
``` bash
streamlit run streamlit_layoutr/example.py
```

If all goes well, you should see a sample app that lets you upload JSON and see it displayed in a graph.

## Deployment to PyPI

To deploy the component to PyPI, you need to build the frontend and package it with the Python code.

1. Update the version number in `setup.py`.

2. Ensure `_RELEASE = True` in `streamlit_layoutr/__init__.py`.

3. Build the frontend:
``` bash
cd streamlit_layoutr/frontend
```
``` bash
npm run build
```
This will create a `dist` folder with the built files.

4. Go to the root directory and build the package:
``` bash
python3 setup.py sdist bdist_wheel
```

5. Upload the package to PyPI (requires access to the PyPI account):
``` bash
pip install twine
twine upload dist/*
```

## References

This template is based on:
* [the original template made by the Streamlit team](https://github.com/streamlit/component-template/tree/master/template), that uses React (instead of Vue 3) and Webpack (instead of Vite).
* [streamlit-component-template-vue](https://github.com/andfanilo/streamlit-component-template-vue/tree/vue3), by [@andfanilo](https://github.com/andfanilo), that uses Vue 2 or 3 and Webpack (instead of Vite).
