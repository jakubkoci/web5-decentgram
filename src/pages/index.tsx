'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Record, Web5 } from '@web5/api'
import { truncate, truncateDid } from '@/utils'

interface RecordWithContent {
  record: Record
  content: Blob
}

export default function Home() {
  console.log('render Home')
  const [web5, setWeb5] = useState<Web5 | null>(null)
  const [myDid, setMyDid] = useState<string>('')
  const [theirDid, setTheirDid] = useState<string>('')
  const [records, setRecords] = useState<RecordWithContent[]>([])
  const [uploadContent, setUploadContent] = useState<File | null>(null)

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
    initWeb5().then((web5) => loadAll(web5, ''))
  }, [])

  const upload = async (web5: Web5 | null, content: File) => {
    console.log('upload')
    if (!web5) throw new Error('Web5 client has not been initialized.')
    const { record } = await web5.dwn.records.create({
      data: new Blob([content], { type: 'image/jpeg' }),
      message: {
        dataFormat: 'image/jpeg',
        // recipient: theirDid,
      },
    })

    if (!record) throw new Error('Record has not been created')
    const readResult = await record.data.text()
    console.log('created')
    const { status } = await record.send(myDid)
    console.log('uploaded', status)
    setUploadContent(null)
    loadAll(web5, '')
  }

  const loadAll = async (web5: Web5 | null, theirDid: string) => {
    console.log('load records')
    if (!web5) throw new Error('Web5 client has not been initialized.')
    const myRecords = await getMyRecords(web5)
    const sharedRecords = await getSharedRecords(web5, theirDid)
    const records = await Promise.all(
      myRecords.concat(sharedRecords).map(async (record: Record) => {
        const content = await record.data.blob()
        logRecord(record, await content.text())
        return { record, content }
      }),
    )
    setRecords(records)
  }

  const getMyRecords = async (web5: Web5) => {
    const queryResult = await web5.dwn.records.query({
      message: {
        filter: {
          dataFormat: 'image/jpeg',
        },
      },
    })
    if (!queryResult.records) {
      console.log('No records find', queryResult)
    }
    return queryResult.records || []
  }

  const getSharedRecords = async (web5: Web5, theirDid: string) => {
    let records: Record[] = []
    const contactDids: string[] = theirDid ? [theirDid] : []
    console.log('theirDid', theirDid)
    console.log('contactDids', contactDids)
    for (const did of contactDids) {
      const queryResult = await web5.dwn.records.query({
        from: did,
        message: {
          filter: {
            dataFormat: 'image/jpeg',
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
          dataFormat: 'image/jpeg',
          recordId,
        },
      },
    })
    console.log('record read result', recordResult)

    const recipientDid = prompt('Enter recipient DID')
    if (!recipientDid) throw new Error('Record ID must not be empty.')

    const recordsWiteResponse = await web5.dwn.records.createFrom({
      data: await recordResult.record.data.blob(),
      author: myDid,
      record: recordResult.record,
      message: {
        dataFormat: 'image/jpeg',
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

  const remove = async (web5: Web5 | null, recordId: string) => {
    if (!web5) throw new Error('Web5 client has not been initialized.')
    console.log('remove')
    const removeResult = await web5.dwn.records.delete({
      message: {
        recordId: recordId,
      },
    })
    console.log('removeResult', removeResult)
  }

  return (
    <main className="container mx-auto space-y-10 py-10">
      <h1 className="mb-8 text-4xl">Decentgram</h1>
      <section>
        <h2 className="mb-2 text-2xl">My DID</h2>
        <div className="space-x-2">
          <input
            className="input input-bordered w-full max-w-xs"
            type="text"
            value={myDid}
            readOnly
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              navigator.clipboard.writeText(myDid)
            }}
          >
            Copy
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-2xl">Their DID</h2>
        <div className="space-x-2">
          <input
            className="input input-bordered w-full max-w-xs"
            type="text"
            value={theirDid}
            onChange={(e) => {
              setTheirDid(e.target.value)
              loadAll(web5, e.target.value)
            }}
          />
          <button
            className="btn btn-primary"
            onClick={async () => {
              const text = await navigator.clipboard.readText()
              setTheirDid(text)
              loadAll(web5, text)
            }}
          >
            Paste
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-2xl">Upload</h2>
        <div className="space-x-2">
          <input
            type="file"
            placeholder="Select image..."
            className="file-input input-bordered w-full max-w-xs"
            onChange={(e) => setUploadContent(e.currentTarget.files![0])}
          />
          <button
            className="btn btn-primary"
            disabled={!uploadContent}
            onClick={() => upload(web5, uploadContent!)}
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
                  <td>
                    <Image
                      src={URL.createObjectURL(content)}
                      alt="post"
                      width={100}
                      height={100}
                    />
                  </td>
                  <td>{truncateDid(record.target)}</td>
                  <td>{truncateDid(record.author)}</td>
                  <td>
                    {record.recipient ? truncateDid(record.recipient) : 'no'}
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
                    <button
                      className="btn btn-primary"
                      onClick={() => remove(web5, record.id)}
                      disabled={
                        !!(record.recipient && record.recipient === myDid)
                      }
                    >
                      Delete
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
