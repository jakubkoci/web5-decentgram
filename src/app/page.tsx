'use client'
import { truncate } from '@/utils'
import { Record, Web5 } from '@web5/api'
import { useEffect, useState } from 'react'

interface RecordWithContent {
  record: Record
  content: string
}

export default function Home() {
  console.log('render Home')
  const [web5, setWeb5] = useState<Web5 | null>(null)
  const [myDid, setMyDid] = useState<string>('')
  const [records, setRecords] = useState<RecordWithContent[]>([])

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
      return web5
    }
    initWeb5().then((web5) => loadAll(web5))
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

  const loadAll = async (web5: Web5 | null) => {
    console.log('load records')
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
    const records = await Promise.all(
      queryResult.records.map(async (record: Record) => {
        const content = await record.data.text()
        logRecord(record, content)
        return { record, content }
      }),
    )
    setRecords(records)
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
            {records.map(({ record, content }) => {
              return (
                <tr key={record.id}>
                  <td className="font-mono">{truncate(record.id, 12)}</td>
                  <td>{content}</td>
                  <td>{truncate(record.target, 10)}</td>
                  <td>{truncate(record.author, 10)}</td>
                  <td>
                    {record.recipient ? truncate(record.recipient, 10) : 'no'}
                  </td>
                  <td>
                    <button
                      className="btn btn-primary"
                      onClick={share}
                      disabled
                    >
                      Share
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </main>
  )
}

const logRecord = (record: Record, content: string) => {
  const { id, author, target, recipient } = record
  console.log({
    id,
    author,
    target,
    recipient,
    content,
  })
}
