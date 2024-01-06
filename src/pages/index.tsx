'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Record, Web5 } from '@web5/api'
import { logRecord, truncate, truncateDid } from '@/utils'

// https://developer.tbd.website/docs/web5/learn/protocols/
// protocol validator UI https://radiant-semifreddo-af73bb.netlify.app/
import protocolDefinition from '../protocol.json' with { type: 'json' }

const CONTACT_DID_STORAGE_KEY = 'contact-did'

interface RecordWithContent {
  record: Record
  content: Blob
}

const configureProtocol = async (web5: Web5, did: string) => {
  const { protocols, status } = await web5.dwn.protocols.query({
    message: {
      filter: {
        protocol: protocolDefinition.protocol,
      },
    },
  })

  if (status.code !== 200) {
    console.error('Error querying protocols', status)
    return
  }

  if (protocols.length > 0) {
    console.log('Protocol already deployed')
    return
  }

  // configure protocol on local DWN
  const { status: configureStatus, protocol } =
    await web5.dwn.protocols.configure({
      message: {
        definition: protocolDefinition,
      },
    })

  console.log('Protocol configured status', configureStatus)

  if (!protocol) throw new Error('Protocol client has not been configured.')

  await protocol.send(did)
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
      const { web5, did } = await Web5.connect({
        techPreview: { dwnEndpoints: ['http://localhost:4000'] },
      })
      setWeb5(web5)
      setMyDid(did)

      if (web5 && did) {
        console.log('web5 client connecet connected')
        console.log('did', did)
      }

      const theirDid = localStorage.getItem(CONTACT_DID_STORAGE_KEY) || ''
      setTheirDid(theirDid)

      return { web5, did, theirDid }
    }
    initWeb5()
      .then(async ({ web5, did, theirDid }) => {
        await configureProtocol(web5, did)
        return { web5, did, theirDid }
      })
      .then(({ web5, did, theirDid }) => loadAll(web5, did, theirDid))
  }, [])

  const upload = async (web5: Web5 | null, did: string, content: File) => {
    console.log('upload')
    if (!web5) throw new Error('Web5 client has not been initialized.')
    const { record } = await web5.dwn.records.create({
      data: new Blob([content], { type: 'image/jpeg' }),
      message: {
        protocol: protocolDefinition.protocol,
        protocolPath: 'post',
        schema: protocolDefinition.types.post.schema,
        dataFormat: protocolDefinition.types.post.dataFormats[0],
      },
    })

    if (!record) throw new Error('Record has not been created')
    const readResult = await record.data.text()
    console.log('created')
    const { status } = await record.send(myDid)
    console.log('uploaded', status)
    setUploadContent(null)
  }

  const loadAll = async (web5: Web5 | null, did: string, theirDid: string) => {
    console.log('load records')
    if (!web5) throw new Error('Web5 client has not been initialized.')

    const myLocalRecords = await getMyRecords(web5, '')
    console.log(
      'My local records',
      myLocalRecords.map((r) => truncate(r.id, 12)),
    )

    const myRemoteRecords = await getMyRecords(web5, did)
    console.log(
      'My remote records',
      myRemoteRecords.map((r) => truncate(r.id, 12)),
    )

    const sharedRecords = await getSharedRecords(web5, theirDid)
    console.log(
      'Shared records',
      sharedRecords.map((r) => truncate(r.id, 12)),
    )

    const records = new Map()
    await Promise.all(
      myLocalRecords
        .concat(myRemoteRecords)
        .concat(sharedRecords)
        .map(async (record: Record) => {
          const content = await record.data.blob()
          logRecord(record, await content.text())
          records.set(record.id, { record, content })
        }),
    )
    setRecords(Array.from(records.values()))
  }

  const getMyRecords = async (web5: Web5, did: string | '') => {
    const queryResult = await web5.dwn.records.query({
      from: did,
      message: {
        filter: {
          protocol: protocolDefinition.protocol,
          dataFormat: protocolDefinition.types.post.dataFormats[0],
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
            protocol: protocolDefinition.protocol,
            dataFormat: protocolDefinition.types.post.dataFormats[0],
          },
        },
      })
      console.log('their records', did, queryResult.records)
      records = records.concat(queryResult.records || [])
    }
    return records
  }

  const share = async (web5: Web5 | null, did: string, recordId: string) => {
    console.log('share', { recordId })
    if (!web5) throw new Error('Web5 client has not been initialized.')

    const recordResult = await web5.dwn.records.read({
      message: {
        filter: {
          protocol: protocolDefinition.protocol,
          dataFormat: protocolDefinition.types.post.dataFormats[0],
          recordId,
        },
      },
    })
    console.log('record read result', recordResult)
    if (!recordResult.record) throw new Error('Record ID not found.')

    const recipientDid = prompt('Enter recipient DID')
    if (!recipientDid) throw new Error('Record ID must not be empty.')

    const recordsWiteResponse = await web5.dwn.records.create({
      data: await recordResult.record.data.blob(),
      message: {
        protocol: protocolDefinition.protocol,
        protocolPath: 'post',
        schema: protocolDefinition.types.post.schema,
        dataFormat: protocolDefinition.types.post.dataFormats[0],
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

    const [isRemovedLocal, isRemovedRemote] = await removeGlobal(
      web5,
      did,
      recordResult.record.id,
    )
    console.log('Original record removed', { isRemovedLocal, isRemovedRemote })
  }

  const removeGlobal = async (
    web5: Web5 | null,
    did: string,
    recordId: string,
  ) =>
    Promise.all([
      remove(web5, undefined, recordId),
      remove(web5, did, recordId),
    ])

  const remove = async (
    web5: Web5 | null,
    did: string | undefined,
    recordId: string,
  ) => {
    if (!web5) throw new Error('Web5 client has not been initialized.')
    console.log('remove', { recordId })
    const removeResult = await web5.dwn.records.delete({
      from: did,
      message: {
        recordId: recordId,
      },
    })
    console.log('removeResult', removeResult)
    return removeResult.status.code === 202
  }

  const saveContact = () => {
    localStorage.setItem(CONTACT_DID_STORAGE_KEY, theirDid)
    loadAll(web5, myDid, theirDid)
  }

  return (
    <main className="container mx-auto space-y-10 px-20 py-10">
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
            onChange={(e) => setTheirDid(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={!theirDid}
            onClick={saveContact}
          >
            Save
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
            onClick={() =>
              upload(web5, myDid, uploadContent!).then(() =>
                loadAll(web5, myDid, theirDid),
              )
            }
          >
            Upload
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-2xl">Images</h2>
        <div className="space-y-10">
          {records.map(({ record, content }) => {
            return (
              <div
                key={record.id}
                className="card bg-base-100 bg-white shadow-xl lg:card-side"
              >
                <figure>
                  <div className="p-10">
                    <Image
                      quality={100}
                      src={URL.createObjectURL(content)}
                      alt={record.id}
                      width={300}
                      height={300}
                    />
                  </div>
                </figure>
                <div className="card-body">
                  <table className="table">
                    <tr>
                      <th className="text-right">ID</th>
                      <td>{truncate(record.id, 12)}</td>
                    </tr>
                    <tr>
                      <th className="text-right">Author</th>
                      <td>{truncateDid(record.author)}</td>
                    </tr>
                    <tr>
                      <th className="text-right">Shared With</th>
                      <td>
                        {record.recipient
                          ? truncateDid(record.recipient)
                          : 'no'}
                      </td>
                    </tr>
                  </table>
                  <div className="card-actions justify-end">
                    <button
                      className="btn btn-primary"
                      onClick={() =>
                        share(web5, myDid, record.id).then(() =>
                          loadAll(web5, myDid, theirDid),
                        )
                      }
                      disabled={
                        !!(record.recipient && record.recipient === myDid)
                      }
                    >
                      Share
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() =>
                        removeGlobal(web5, myDid, record.id).then(() =>
                          loadAll(web5, myDid, theirDid),
                        )
                      }
                      disabled={
                        !!(record.recipient && record.recipient === myDid)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
