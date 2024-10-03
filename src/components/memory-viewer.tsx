"use client"

import { useState, useRef, useCallback, useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const MEMORY_SECTIONS = [
  { start: 0x100000000, end: 0x1FFFFFFFF, name: "Program code" },
  { start: 0x200000000, end: 0x2FFFFFFFF, name: "Stack data" },
  { start: 0x300000000, end: 0x3FFFFFFFF, name: "Heap data" },
  { start: 0x400000000, end: 0x4FFFFFFFF, name: "Program input parameters" },
]

const PROGRAM_INPUT_REGIONS = [
  { name: "Number of accounts", size: 8, color: "bg-blue-400" },
  { 
    name: "Account Flags", 
    size: 4, 
    color: "bg-green-400",
    subRegions: [
      { name: "Is Signer", size: 1, color: "bg-green-300" },
      { name: "Is Writable", size: 1, color: "bg-green-400" },
      { name: "Is Executable", size: 1, color: "bg-green-500" },
      { name: "Is Duplicate", size: 1, color: "bg-green-600" },
    ]
  },
  { name: "Padding 1", size: 4, color: "bg-gray-400", isPadding: true },
  { 
    name: "Public keys", 
    size: 64, 
    color: "bg-purple-400",
    subRegions: [
      { name: "Account Pub Key", size: 32, color: "bg-indigo-400" },
      { name: "Account Owner Pub Key", size: 32, color: "bg-violet-400" },
    ]
  },
  { name: "Lamports", size: 8, color: "bg-red-400" },
  { name: "Account data size", size: 8, color: "bg-indigo-400" },
  { name: "Account data", size: 32, color: "bg-pink-400", isDynamic: true },
  { name: "Realloc padding", size: 10240, color: "bg-gray-500", isPadding: true },
  { name: "Rent epoch", size: 8, color: "bg-teal-400" },
  { name: "Instruction data size", size: 8, color: "bg-cyan-400" },
  { name: "Instruction data", size: 32, color: "bg-lime-400", isDynamic: true },
  { name: "Program ID", size: 32, color: "bg-amber-400" },
]

const COLS = 16
const BYTES_PER_ROW = 16
const MIN_ROWS = 16

type MemorySection = {
  start: number
  end: number
  name: string
}

type SubRegion = {
  name: string
  size: number
  color: string
}

type Region = {
  name: string
  size: number
  color: string
  subRegions?: SubRegion[]
  isDynamic?: boolean
  isPadding?: boolean
}

export default function MemoryViewer() {
  const [selectedSection, setSelectedSection] = useState<MemorySection>(MEMORY_SECTIONS[3])
  const [focusedRegion, setFocusedRegion] = useState<string | null>(null)
  const [accountDataSize, setAccountDataSize] = useState<number>(32)
  const [instructionDataSize, setInstructionDataSize] = useState<number>(32)
  const [numberOfAccounts, setNumberOfAccounts] = useState<number>(1)
  const listRef = useRef<List>(null)

  const programInputRegions = useMemo(() => {
    return PROGRAM_INPUT_REGIONS.map(region => 
      region.name === "Account data" ? { ...region, size: accountDataSize } :
      region.name === "Instruction data" ? { ...region, size: instructionDataSize } :
      region
    )
  }, [accountDataSize, instructionDataSize])

  const totalNamedRegionSize = useMemo(() => 
    programInputRegions.reduce((sum, region) => sum + region.size, 0),
    [programInputRegions]
  )

  const maxRows = useMemo(() => 
    Math.ceil(totalNamedRegionSize / BYTES_PER_ROW) + 1,
    [totalNamedRegionSize]
  )

  const totalRows = useMemo(() => {
    if (selectedSection.name === "Program input parameters") {
      return Math.max(MIN_ROWS, maxRows)
    } else {
      return Math.max(MIN_ROWS, Math.ceil((selectedSection.end - selectedSection.start + 1) / BYTES_PER_ROW))
    }
  }, [selectedSection, maxRows])

  const scrollToBottom = () => {
    listRef.current?.scrollToItem(totalRows - 1)
  }

  const getRegionOffset = useCallback((regionName: string) => {
    let offset = 0
    for (const region of programInputRegions) {
      if (region.name === regionName) {
        return offset
      }
      offset += region.size
    }
    return -1
  }, [programInputRegions])

  const getMemoryValue = useCallback((index: number) => {
    if (selectedSection.name === "Program input parameters") {
      if (focusedRegion === "Account data size") {
        const offset = getRegionOffset("Account data size")
        if (index >= offset && index < offset + 8) {
          const littleEndianBytes = new Uint8Array(new BigUint64Array([BigInt(accountDataSize)]).buffer)
          return littleEndianBytes[index - offset].toString(16).padStart(2, '0')
        }
      } else if (focusedRegion === "Instruction data size") {
        const offset = getRegionOffset("Instruction data size")
        if (index >= offset && index < offset + 8) {
          const littleEndianBytes = new Uint8Array(new BigUint64Array([BigInt(instructionDataSize)]).buffer)
          return littleEndianBytes[index - offset].toString(16).padStart(2, '0')
        }
      } else if (focusedRegion === "Number of accounts") {
        const offset = getRegionOffset("Number of accounts")
        if (index >= offset && index < offset + 8) {
          const littleEndianBytes = new Uint8Array(new BigUint64Array([BigInt(numberOfAccounts)]).buffer)
          return littleEndianBytes[index - offset].toString(16).padStart(2, '0')
        }
      }
    }
    return (index % 256).toString(16).padStart(2, '0')
  }, [selectedSection, focusedRegion, accountDataSize, instructionDataSize, numberOfAccounts, getRegionOffset])

  const getRegionColor = useCallback((byteOffset: number) => {
    if (selectedSection.name !== "Program input parameters") {
      return "bg-gray-800"
    }
    let currentOffset = 0
    for (const region of programInputRegions) {
      if (byteOffset >= currentOffset && byteOffset < currentOffset + region.size) {
        if (focusedRegion) {
          if (focusedRegion === "Account data size" && region.name === "Account data") {
            return region.color + " opacity-50"
          }
          if (focusedRegion === "Instruction data size" && region.name === "Instruction data") {
            return region.color + " opacity-50"
          }
          if (focusedRegion === region.name && region.subRegions) {
            let subRegionOffset = currentOffset
            for (const subRegion of region.subRegions) {
              if (byteOffset >= subRegionOffset && byteOffset < subRegionOffset + subRegion.size) {
                return subRegion.color
              }
              subRegionOffset += subRegion.size
            }
          }
          return focusedRegion === region.name ? region.color : "bg-gray-700"
        }
        return region.isPadding ? `${region.color} crosshatch` : region.color
      }
      currentOffset += region.size
    }
    return "bg-gray-800"
  }, [selectedSection, focusedRegion, programInputRegions])

  const Row = useCallback(({ index, style }: { index: number, style: React.CSSProperties }) => (
    <div style={style} className="flex font-mono text-sm">
      <div className="w-32 p-1 text-right font-bold text-gray-400">
        {`0x${(selectedSection.start + index * BYTES_PER_ROW).toString(16).toUpperCase().padStart(9, '0')}`}
      </div>
      {[...Array(COLS)].map((_, col) => {
        const byteOffset = index * COLS + col
        const relativeOffset = byteOffset - (selectedSection.start - MEMORY_SECTIONS[0].start)
        return (
          <TooltipProvider key={col}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`w-8 p-1 text-center border border-gray-600 ${getRegionColor(byteOffset)} text-white cursor-pointer`}>
                  {getMemoryValue(byteOffset)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Offset: +{relativeOffset}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  ), [selectedSection, getRegionColor, getMemoryValue])

  const getRegionStartRow = useCallback((regionName: string) => {
    let currentOffset = 0
    for (const region of programInputRegions) {
      if (region.name === regionName) {
        return Math.floor(currentOffset / BYTES_PER_ROW)
      }
      currentOffset += region.size
    }
    return 0
  }, [programInputRegions])

  const handleAccordionChange = useCallback((value: string) => {
    if (value === focusedRegion) {
      setFocusedRegion(null)
    } else if (value) {
      setFocusedRegion(value)
      const startRow = getRegionStartRow(value)
      listRef.current?.scrollToItem(startRow, "start")
    } else {
      setFocusedRegion(null)
    }
  }, [focusedRegion, getRegionStartRow])

  const handleAccountDataSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setAccountDataSize(isNaN(value) ? 0 : value)
  }, [])

  const handleInstructionDataSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setInstructionDataSize(isNaN(value) ? 0 : value)
  }, [])

  const handleNumberOfAccountsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setNumberOfAccounts(isNaN(value) ? 0 : Math.min(Math.max(value, 0), 64))
  }, [])

  const toLittleEndian = useCallback((num: number): string => {
    const buffer = new ArrayBuffer(8)
    const view = new DataView(buffer)
    view.setBigUint64(0, BigInt(num), true)
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')
  }, [])

  return (
    <div className="container mx-auto p-4 bg-gray-900 text-white min-h-screen">
      <style jsx global>{`
        .crosshatch {
          background-image: linear-gradient(45deg, rgba(255, 255, 255, 0.15) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.15) 75%, transparent 75%, transparent);
          background-size: 10px 10px;
        }
      `}</style>
      <h1 className="text-2xl font-bold mb-4">Solana Memory Viewer</h1>
      <div className="flex flex-wrap gap-4 mb-4">
        {MEMORY_SECTIONS.map((section) => (
          <Button
            key={section.start}
            onClick={() => setSelectedSection(section)}
            variant={selectedSection.start === section.start ? "default" : "outline"}
            className="bg-gray-800 text-white border-gray-600 hover:bg-gray-700"
          >
            {section.name}
          </Button>
        ))}
        <Button onClick={scrollToBottom} className="bg-gray-800 text-white border-gray-600 hover:bg-gray-700">Scroll to End</Button>
      </div>
      <div className="flex flex-col lg:flex-row gap-4">
        <Card className="flex-grow bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">{selectedSection.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm overflow-x-auto">
              <div className="flex mb-1">
                <div className="w-32"></div>
                {[...Array(16)].map((_, i) => (
                  <div key={i} className="w-8 p-1 text-center font-bold text-gray-400">
                    {i.toString(16).toUpperCase()}
                  </div>
                ))}
              </div>
              <div className="h-[600px]">
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      ref={listRef}
                      height={height}
                      itemCount={totalRows}
                      itemSize={30}
                      width={width}
                      overscanCount={5}
                    >
                      {Row}
                    </List>
                  )}
                </AutoSizer>
              </div>
            </div>
          </CardContent>
        </Card>
        {selectedSection.name === "Program input parameters" && (
          <Card className="lg:w-1/3 bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible onValueChange={handleAccordionChange}>
                {programInputRegions.map((region: Region, index) => (
                  <AccordionItem key={index} value={region.name}>
                    <AccordionTrigger className={`p-2 ${region.isPadding ? `${region.color} crosshatch` : region.color} rounded text-gray-900`}>
                      <div className="flex justify-between w-full">
                        <span>{region.name}</span>
                        <span className="font-mono">{region.size} bytes</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {region.name === "Number of accounts" || region.name === "Account data size" || region.name === "Instruction data size" ? (
                        <div className="pl-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-white">Decimal:</span>
                            <Input
                              type="number"
                              value={
                                region.name === "Number of accounts" ? numberOfAccounts :
                                region.name === "Account data size" ? accountDataSize :
                                instructionDataSize
                              }
                              onChange={
                                region.name === "Number of accounts" ? handleNumberOfAccountsChange :
                                region.name === "Account data size" ? handleAccountDataSizeChange :
                                handleInstructionDataSizeChange
                              }
                              min={0}
                              max={region.name === "Number of accounts" ? 64 : undefined}
                              className="w-32 text-right"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-white">Little Endian:</span>
                            <span className="font-mono text-white">
                              {toLittleEndian(
                                region.name === "Number of accounts" ? numberOfAccounts :
                                region.name === "Account data size" ? accountDataSize :
                                region.name === "Instruction data size" ? instructionDataSize : 0
                              )}
                            </span>
                          </div>
                        </div>
                      ) : region.subRegions ? (
                        <div className="pl-4">
                          {region.subRegions.map((subRegion, subIndex) => (
                            <div key={subIndex} className={`flex justify-between py-1 ${subRegion.color} rounded px-2 my-1 text-gray-900`}>
                              <span>{subRegion.name}</span>
                              <span className="font-mono">{subRegion.size} bytes</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="pl-4 py-1 text-white">No additional details</div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}