"use client"
import styles from "./component.module.css"
import { ApiMediaResults } from '@/app/ts/interfaces/apiAnilistDataInterface';
import { initFirebase } from '@/firebase/firebaseApp';
import { getAuth } from 'firebase/auth';
import {
    FieldPath,
    doc, getDoc,
    getFirestore, setDoc
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth';
import { MediaPlayer, MediaProvider, Track } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import { CaptionsFileFormat, CaptionsParserFactory } from 'media-captions';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

type VideoPlayerType = {
    source: string,
    mediaSource: string,
    media: ApiMediaResults,
    episode: string,
    episodeId: string,
    subtitles?: {
        kind: string,
        default: boolean | undefined,
        file: string,
        label: string
    }[],
    videoQualities?: {
        url: string,
        quality: "360p" | "480p" | "720p" | "1080p" | "default" | "backup",
        isM3U8: boolean
    }[]
}

type SubtitlesType = {
    src: string | undefined,
    kind: string | TextTrackKind,
    label: string | undefined,
    srcLang: string | undefined,
    type: string | CaptionsParserFactory | undefined,
    default: boolean | undefined,
}

function Player({ source, mediaSource, subtitles, videoQualities, media, episodeId, episode }: VideoPlayerType) {

    const [subList, setSubList] = useState<SubtitlesType[] | undefined>(undefined)

    const [addOnKeepWatching, setAddOnKeepWatching] = useState<boolean>(false)

    const auth = getAuth()

    const [user, loading] = useAuthState(auth)

    const [videoSource, setVideoSource] = useState<string>()

    const db = getFirestore(initFirebase());

    async function getUserPreferedLanguage() {

        let preferredLanguage: string | null = null

        if (user) {

            const data = await getDoc(doc(db, "users", user.uid))

            preferredLanguage = await data.get("videoSubtitleLanguage")

        }

        // get user language and filter through the available subtitles to this media
        let subListMap: SubtitlesType[] = []

        subtitles?.map((item) => {

            const isDefaultLang = (preferredLanguage && item.label) ?
                item.label.toLowerCase().includes(preferredLanguage.toLowerCase())
                :
                item.default || item.label == "English"

            subListMap.push({
                kind: item.kind,
                srcLang: item.label,
                src: item.file,
                default: isDefaultLang,
                label: item.label,
                type: item.kind
            })

        })

        setSubList(subListMap)
    }

    async function getUserVideoQuality() {

        let userVideoQuality: string | null = null

        if (user) {

            const data = await getDoc(doc(db, "users", user.uid))

            userVideoQuality = await data.get("videoQuality")

        }

        if (!userVideoQuality) return setVideoSource(source)

        // get which that matches the available qualities of this media
        let videoSourceMatchedUserQuality

        videoQualities?.map((item) => {

            if (userVideoQuality == item.quality) videoSourceMatchedUserQuality = item.url

        })

        setVideoSource(videoSourceMatchedUserQuality || source)
    }

    // adds media to keep watching
    // every time user watchs this episode, it will update time on DOC
    async function addToKeepWatching() {

        if (addOnKeepWatching) return

        await setDoc(doc(db, "users", user!.uid),
            {
                keepWatching: {
                    [media.id]: {
                        id: media.id,
                        title: {
                            romaji: media.title.romaji
                        },
                        format: media.format,
                        coverImage: {
                            extraLarge: media.coverImage.extraLarge,
                            large: media.coverImage.large
                        },
                        episode: episode,
                        episodeId: episodeId,
                        source: mediaSource,
                        updatedAt: Date.parse(new Date(Date.now() - 0 * 24 * 60 * 60 * 1000) as any) / 1000
                    }
                }
            } as unknown as FieldPath,
            { merge: true }
        )

        setAddOnKeepWatching(true)

    }

    useEffect(() => {

        getUserPreferedLanguage()
        getUserVideoQuality()

    }, [user, loading, source])

    return (
        (!loading && subList && videoSource) && (
            <MediaPlayer
                className={styles.container}
                title={media.title.romaji}
                src={videoSource}
                autoPlay
                volume={0.5}
                onProgressCapture={(e: any) =>
                    (
                        user &&
                        (Math.round(e.target.currentTime) > 25) &&
                        (Math.round(e.target.currentTime) % 2) &&
                        !addOnKeepWatching
                    ) &&
                    addToKeepWatching()
                }
            >
                <MediaProvider >
                    {subList.map((item) => (
                        <Track
                            key={item.src}
                            src={item.src}
                            kind={item.kind as TextTrackKind}
                            label={item.label}
                            lang={item.srcLang}
                            type={item.kind as CaptionsFileFormat}
                            default={item.default}
                        />
                    ))}
                </MediaProvider>

                <DefaultVideoLayout
                    icons={defaultLayoutIcons}
                    thumbnails={media.bannerImage || undefined}
                />
            </MediaPlayer >
        )
    )
}

export default Player