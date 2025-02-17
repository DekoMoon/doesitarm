
import {
    describe,
    it,
    expect
} from 'vitest'

import fs from 'fs-extra'
import path from 'node:path'
// https://github.com/mrmlnc/fast-glob
import glob from 'fast-glob'
import { LocalFileData } from 'get-file-object-from-local-path'
import { Zip } from 'zip-lib'

import { AppScan } from '~/helpers/scanner/client.mjs'
// import { compress } from '~/helpers/scanner/parsers/seven-zip'


const appGlobOptions = {
    onlyFiles: false,
    deep: 1
}

const appsPath = 'test/_artifacts/apps'

const tempPath = 'test/_artifacts/temp'

// TODO: Unsupported Apps:
// Alt Tab 6.29.0 - Hangs
// Silicon - Fail with both MachoNode and MachoManiac
// arm_idafree76_mac 7.6 - Hangs
// Batteries 2.2.4 - Hangs
// BetterZip 5.1.1 - Hangs
// BlueJeans - May work but doesn't work with zip compression
// Coreform-Cubit - No info.plist, may not need to be supported
const plainAppBundles = glob
    .sync( `${ appsPath }/**/*.app`, appGlobOptions )
    .filter( bundlePath => {
        return true
        // return bundlePath.includes( 'AV' )
    })


async function makeZipFromBundlePath ( bundlePath ) {
    const archivePath = `${ tempPath }/${ bundlePath.split('/').pop() }.zip`

    // Delete any existing archive
    if ( await fs.exists( archivePath ) ) {
        console.log( 'Deleting existing archive', archivePath )
        await fs.unlink( archivePath )
    }

    // console.log( 'archivePath', archivePath )

    // await compress( bundlePath, archivePath )

    const zipLib = new Zip()

    // Adds a folder from the file system, putting its contents at the root of archive
    zipLib.addFolder( bundlePath )

    // Generate zip file.
    await zipLib.archive( archivePath )

    // Create a File Object from the zip file
    // https://developer.mozilla.org/en-US/docs/Web/API/File/File
    const archiveFile = new LocalFileData( archivePath )

    // console.log( 'archiveFile', archiveFile )

    return archiveFile
}


describe.concurrent('Apps', async () => {

    // Compress plain app bundles to zipped File Objects
    for ( const bundlePath of plainAppBundles ) {

        const appName = path.basename( bundlePath )

        // Create a new AppScan instance
        const scan = new AppScan({
            fileLoader: () => makeZipFromBundlePath( bundlePath ),
            messageReceiver: ( details ) => {
                console.log( 'Scan message:', details )
            }
        })

        // Scan the archive
        await scan.start()


        it( `Can read info.plist for ${ appName } bundle` , () => {
            // console.log( 'infoPlist', scan.infoPlist )

            expect( scan.hasInfoPlist ).toBe( true )
        })

        it( `Can read macho meta for entry ${ appName } bundle`, () => {
            // console.log( 'machoMeta', scan.machoMeta )

            expect( scan.hasMachoMeta ).toBe( true )
        })

        it( `Can provide scan info for ${ appName } bundle`, () => {
            // console.log( 'machoMeta', scan.machoMeta )

            expect( scan.hasInfo ).toBe( true )

            // Expect the scan info to have a bundle name that matches the app name
            expect( scan.info.filename ).toContain( appName )

            // Expect app version is string
            expect( typeof scan.info.appVersion ).toBe( 'string' )

            // Expect that machoMeta is an object
            expect( typeof scan.info.machoMeta ).toBe( 'object' )

            // Expect that supportedArchitectures is not empty
            expect( scan.supportedArchitectures.length ).toBeGreaterThan( 0 )

            // Expect that processorType is a string
            expect( typeof scan.supportedArchitectures[0].processorType ).toBe( 'string' )

            const validCPUTypes = [
                'ANY', 'VAX', 'MC680', 'X86', 'MIPS', 'MC98000', 'HPPA', 'ARM', 'ARM64', 'MC88000', 'SPARC', 'I860', 'POWERPC', 'POWERPC64'
            ]

            // Expect that processorType is a valid CPU type
            expect( validCPUTypes.includes( scan.supportedArchitectures[0].processorType ) ).toBe( true )

            // Expect that first of machoMeta.architectures has processorSubType as string
            // expect( typeof scan.supportedArchitectures[0].processorSubType ).toBeTruthy()

            // Export info.infoPlist to be none empty object
            expect( typeof scan.info.infoPlist ).toBe( 'object' )
            expect( Object.keys( scan.info.infoPlist ).length ).toBeGreaterThan( 0 )

        })

    }

})


