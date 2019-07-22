# Layoutr
A graph layout web application

## Installation

After a git checkout, run the following to serve the application locally:

```
npm i
npm run serve
```

## Usage

* Click "UPLOAD CVS OR JSON" to upload a file of the form:
```
source,target
a,b
b,c
c,d
d,a
```
for CSV and
```
{
  "edges": [
    {
      "source": "a",
      "target": "b"
      },
    {
      "source": "b",
      "target": "c"
    },
    {
      "source": "c",
      "target": "d"
    },
    {
      "source": "d",
      "target": "a"
    }
  ]
}
```
for JSON

* Click "Start Layout".
* Play with the controls!
