import React, { useState, useEffect, useRef } from 'react'
import './App.css'
import { EditorView, basicSetup } from 'codemirror'
import { placeholder as cmPlaceholder } from '@codemirror/view'
import { xml } from '@codemirror/lang-xml'
import { json } from '@codemirror/lang-json'
import { OoxmlProcessor } from './lib/ooxml/ooxmlProcessor'

// Simple test component to verify React is working
const App: React.FC = () => {
  const [xmlContent, setXmlContent] = useState<string>('')
  const [jsonData, setJsonData] = useState<string>(`{
  "steplessornumber": {
    "questionlessornumber": "Non, une seule personne est bailleur du bien"
  },
  "step_info": {
    "q_companyname": {
      "q_companyname": "Example Company Ltd"
    }
  }
}`)
  const [processedXml, setProcessedXml] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [simplified, setSimplified] = useState(false)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'text/xml') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result
        if (typeof result === 'string') {
          setXmlContent(result)
          setError('')
        }
      }
      reader.readAsText(file)
    } else {
      setError('Please select a valid XML file')
    }
  }

  const processXml = () => {
    if (!xmlContent.trim()) {
      setError('Please provide XML content')
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      let data: Record<string, any> = {}
      if (jsonData.trim()) {
        data = JSON.parse(jsonData)
      }

      // Instantiate OoxmlProcessor and process the XML
      const processor = new OoxmlProcessor(xmlContent)
      // For merge fields only:
      // const result = processor.processMergeFields()
      // For IF fields (with data):
      // const result = processor.processIfFields(data)
      // For both, you might want to chain or combine:
      let result = processor.processMergeFields()
      result = new OoxmlProcessor(result).processIfFields(data)
      setProcessedXml(result)
    } catch (err) {
      const error = err as { message: string }
      setError(`Processing error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const loadSampleXml = () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Company: </w:t>
      </w:r>
      <w:r>
        <w:fldChar w:fldCharType="begin"/>
      </w:r>
      <w:r>
        <w:instrText> MERGEFIELD step_info.q_companyname.q_companyname </w:instrText>
      </w:r>
      <w:r>
        <w:fldChar w:fldCharType="separate"/>
      </w:r>
      <w:r>
        <w:t>«step_info.q_companyname.q_companyname»</w:t>
      </w:r>
      <w:r>
        <w:fldChar w:fldCharType="end"/>
      </w:r>
    </w:p>
  </w:body>
</w:document>`
    setXmlContent(sampleXml)
    setError('')
  }

  const handleSimplifiedToggle = () => {
    setSimplified((prev) => {
      const newVal = !prev
      if (newVal) {
        // Simplify both XML input and processed output
        if (xmlContent.trim()) {
          const simplifiedXml = new OoxmlProcessor(xmlContent).simplifyXml()
          setXmlContent(simplifiedXml)
        }
        if (processedXml.trim()) {
          const simplifiedProcessed = new OoxmlProcessor(processedXml).simplifyXml()
          setProcessedXml(simplifiedProcessed)
        }
      }
      return newVal
    })
  }

  const CodeMirrorEditor = ({
    value,
    onChange,
    readOnly = false,
    height = '24rem',
    language = 'xml',
    placeholder = '',
  }: {
    value: string
    onChange?: (val: string) => void
    readOnly?: boolean
    height?: string
    language?: 'xml' | 'json'
    placeholder?: string
  }) => {
    const editorRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)

    useEffect(() => {
      if (!editorRef.current) return

      if (viewRef.current) {
        viewRef.current.destroy()
      }

      viewRef.current = new EditorView({
        doc: value,
        extensions: [
          basicSetup,
          language === 'json' ? json() : xml(),
          EditorView.editable.of(!readOnly),
          EditorView.updateListener.of((v) => {
            if (v.docChanged && onChange) {
              onChange(v.state.doc.toString())
            }
          }),
          EditorView.theme({
            '&': { height },
          }),
          cmPlaceholder(placeholder),
        ],
        parent: editorRef.current,
      })

      return () => {
        viewRef.current?.destroy()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorRef, readOnly, height, language])

    useEffect(() => {
      if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: value,
          },
        })
      }
    }, [value])

    return <div ref={editorRef} />
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">OOXML Field Processor</h1>
          <p className="text-gray-600">
            Test MERGEFIELD and IF field processing in Word OOXML documents with TypeScript
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <h2 className="text-xl font-semibold">XML Input</h2>
                <label className="ml-4 flex items-center text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simplified}
                    onChange={handleSimplifiedToggle}
                    className="mr-2"
                  />
                  Simplified view
                </label>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload XML File
                  </label>
                  <input
                    type="file"
                    accept=".xml"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                <div>
                  <button
                    onClick={loadSampleXml}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    Load Sample XML
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    XML Content
                  </label>
                  <CodeMirrorEditor
                    value={xmlContent}
                    onChange={setXmlContent}
                    language="xml"
                    placeholder="Paste your OOXML content here..."
                    height="16rem"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">JSON Data</h2>
              <p className="text-sm text-gray-600 mb-4">
                Data for IF field evaluation (optional)
              </p>
              <CodeMirrorEditor
                value={jsonData}
                onChange={setJsonData}
                language="json"
                placeholder="Enter JSON data for IF field processing..."
                height="12rem"
              />
            </div>

            <button
              onClick={processXml}
              disabled={isProcessing || !xmlContent.trim()}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : 'Process OOXML'}
            </button>
          </div>

          {/* Output Section */}
          <div>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Processed Output</h2>
              <p className="text-sm text-gray-600 mb-4">
                Transformed OOXML with processed fields
              </p>
              <CodeMirrorEditor
                value={processedXml}
                readOnly
                language="xml"
                placeholder="Processed XML will appear here..."
                height="24rem"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

