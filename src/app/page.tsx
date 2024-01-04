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
  const [uploadContent, setUploadContent] = useState('')

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
    initWeb5().then(loadAll)
  }, [])

  const upload = async (web5: Web5 | null, content: string) => {
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
    setUploadContent('')
    loadAll(web5)
  }

  const loadAll = async (web5: Web5 | null) => {
    console.log('load records')
    if (!web5) throw new Error('Web5 client has not been initialized.')
    const myRecords = await getMyRecords(web5)
    const sharedRecords = await getSharedRecords(web5)
    const records = await Promise.all(
      myRecords.concat(sharedRecords).map(async (record: Record) => {
        const content = await record.data.text()
        logRecord(record, content)
        return { record, content }
      }),
    )
    setRecords(records)
  }

  const getMyRecords = async (web5: Web5) => {
    const queryResult = await web5.dwn.records.query({
      message: {
        filter: {
          dataFormat: 'text/plain',
        },
      },
    })
    if (!queryResult.records) {
      console.log('No records find', queryResult)
    }
    return queryResult.records || []
  }

  const getSharedRecords = async (web5: Web5) => {
    let records: Record[] = []
    const contactDids: string[] = []
    for (const did of contactDids) {
      const queryResult = await web5.dwn.records.query({
        from: did,
        message: {
          filter: {
            dataFormat: 'text/plain',
          },
        },
      })
      records = records.concat(queryResult.records || [])
    }
    return records
  }

  const share = async (web5: Web5 | null, recordId: string) => {
    console.log('share', { recordId })
    if (!web5) throw new Error('Web5 client has not been initialized.')

    const recordResult = await web5.dwn.records.read({
      message: {
        filter: {
          dataFormat: 'text/plain',
          recordId,
        },
      },
    })
    console.log('record read result', recordResult)

    const recipientDid = prompt('Enter recipient DID')
    if (!recipientDid) throw new Error('Record ID must not be empty.')

    const recordsWiteResponse = await web5.dwn.records.createFrom({
      data: await recordResult.record.data.text(),
      author: myDid,
      record: recordResult.record,
      message: {
        dataFormat: 'text/plain',
        recipient: recipientDid,
      },
    })
    console.log('record createFrom response', recordsWiteResponse)
    const { record } = recordsWiteResponse
    if (!record) {
      throw new Error('Record has not been created from other record')
    }
    console.log('record created', record.id)
    const { status } = await record.send(myDid)
    console.log('uploaded', status)
  }

  return (
    <main className="container mx-auto space-y-4">
      <h1 className="mb-8 text-4xl">Decentgram</h1>
      <section>
        <h2 className="mb-2 text-2xl">My DID</h2>
        <div>{myDid}</div>
      </section>
      <section>
        <h2 className="mb-2 text-2xl">Upload</h2>
        <div className="space-x-2">
          <input
            type="text"
            placeholder="Select image..."
            className="input input-bordered w-full max-w-xs"
            value={uploadContent}
            onChange={(e) => setUploadContent(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={!uploadContent}
            onClick={() => upload(web5, uploadContent)}
          >
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
              <th>Recipient</th>
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
                      onClick={() => share(web5, record.id)}
                      disabled={
                        !!(record.recipient && record.recipient === myDid)
                      }
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
