'use client'
import { Record, Web5 } from '@web5/api'
import { stat } from 'fs'
import { useEffect, useState } from 'react'

export default function Home() {
  console.log('render Home')
  const [web5, setWeb5] = useState<Web5 | null>(null)
  const [myDid, setMyDid] = useState<string>('')

  useEffect(() => {
    const initWeb5 = async () => {
      console.log('connect web5 client')
      const { web5, did } = await Web5.connect()
      setWeb5(web5)
      setMyDid(did)

      if (web5 && did) {
        console.log('web5 client connecet connected')
        console.log('did', did)
      }
    }
    initWeb5()
  }, [])

  const upload = async () => {
    const content = 'Fourth Message for Bob'
    console.log('upload')
    if (!web5) throw new Error('Web5 client has not been initialized.')
    const { record } = await web5.dwn.records.create({
      data: content,
      message: {
        dataFormat: 'text/plain',
        // recipient: bobDid,
      },
    })

    if (!record) throw new Error('Record has not been created')
    const readResult = await record.data.text()
    console.log('created')
    const { status } = await record.send(myDid)
    console.log('uploaded', status)
  }

  const show = async () => {
    console.log('show records')
    if (!web5) throw new Error('Web5 client has not been initialized.')
    const queryResult = await web5.dwn.records.query({
      // from: myDid,
      message: {
        filter: {
          dataFormat: 'text/plain',
        },
      },
    })
    if (!queryResult.records) throw new Error('No records found')
    printRecords(queryResult.records)
  }

  const showSharedWithMe = async () => {
    console.log('show records')
    if (!web5) throw new Error('Web5 client has not been initialized.')
    const contactDid = '<insert contact did>'
    const queryResult = await web5.dwn.records.query({
      from: contactDid,
      message: {
        filter: {
          dataFormat: 'text/plain',
        },
      },
    })
    if (!queryResult.records) throw new Error('No records found')
    printRecords(queryResult.records)
  }

  const share = async () => {
    console.log('share')
    const recordId = '<insert record id>'
    if (!web5) throw new Error('Web5 client has not been initialized.')

    const recordResult = await web5.dwn.records.read({
      message: {
        filter: {
          dataFormat: 'text/plain',
          recordId,
        },
      },
    })

    console.log('recordResult', recordResult)
    const recipientDid = '<insert recipient did>'

    const recordsWiteResponse = await web5.dwn.records.createFrom({
      author: myDid,
      data: await recordResult.record.data.text(),
      message: {
        dataFormat: 'text/plain',
        recipient: recipientDid,
      },
      record: recordResult.record,
    })
    console.log('recordsWiteResponse', recordsWiteResponse)
    const { record } = recordsWiteResponse
    if (!record) throw new Error('no record 102')
    console.log('record created', record.id)
    const { status } = await record.send(myDid)
    console.log('uploaded', status)
  }

  return (
    <main className="container mx-auto space-y-4">
      <h1 className="mb-8 text-4xl">Decentgram</h1>
      <section>
        <h2 className="mb-2 text-2xl">Upload</h2>
        <div className="space-x-2">
          <input
            type="text"
            placeholder="Select image..."
            className="input input-bordered w-full max-w-xs"
          />
          <button className="btn btn-primary" onClick={upload}>
            Upload
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-2xl">Images</h2>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Content</th>
              <th>Target</th>
              <th>Author</th>
              <th>Shared</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-mono">bafyreih6wfb...h2hglg3h33ba</td>
              <td>Thrid Message for Bob</td>
              <td>did:ion:EiAVV...XdyeQ</td>
              <td>did:ion:EiAVV...XdyeQ</td>
              <td>did:ion:EiAZI...h9PVA</td>
              <td>
                <button className="btn btn-primary" onClick={share}>
                  Share
                </button>
              </td>
            </tr>
            <tr>
              <td className="font-mono">bafyreidhvsr...i3ssqilld7ti</td>
              <td>Second Message for Bob</td>
              <td>did:ion:EiAVV...XdyeQ</td>
              <td>did:ion:EiAVV...XdyeQ</td>
              <td>no</td>
              <td>
                <button className="btn btn-primary" onClick={share}>
                  Share
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <button className="btn btn-primary" onClick={show}>
        Show
      </button>
    </main>
  )
}

const printRecords = async (records: Record[]) => {
  console.log(`records count`, records.length)
  console.log(`records:\n`)

  for (const record of records) {
    const { id, author, target, recipient } = record
    const content = await record.data.text()
    console.log({
      id,
      author,
      target,
      recipient,
      content,
    })
    console.log('=========================\n')
  }
}
