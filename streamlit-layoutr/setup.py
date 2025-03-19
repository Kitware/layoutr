from pathlib import Path

import setuptools

this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text()

setuptools.setup(
    name="streamlit-layoutr",
    version="0.0.1",
    author="John Smith",
    author_email="john@example.com",
    description="Streamlit component for graph visualization",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/kitware/layoutr",
    packages=setuptools.find_packages(),
    include_package_data=True,
    classifiers=[],
    python_requires=">=3.7",
    install_requires=[
        "streamlit >= 0.63",
    ],
)
