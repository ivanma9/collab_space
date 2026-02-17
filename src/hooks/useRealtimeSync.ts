/**
 * useRealtimeSync Hook
 *
 * Implements Pattern B: Broadcast for instant sync + async DB persistence
 *
 * Flow:
 * 1. User creates/modifies object → Broadcast to all clients (instant visual feedback)
 * 2. Simultaneously write to Postgres (async persistence)
 * 3. On reconnect → Load full board state from Postgres
 *
 * Performance targets:
 * - Object sync latency: <100ms (including DB write)
 * - Visual feedback: Instant (Broadcast bypasses DB)
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { BoardObject } from '../lib/database.types'

interface UseRealtimeSyncOptions {
  boardId: string
  userId: string
}

interface UseRealtimeSyncReturn {
  objects: BoardObject[]
  createObject: (object: Omit<BoardObject, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => Promise<void>
  updateObject: (id: string, updates: Partial<BoardObject>) => Promise<void>
  deleteObject: (id: string) => Promise<void>
  isLoading: boolean
  error: string | null
}

export function useRealtimeSync({
  boardId,
  userId,
}: UseRealtimeSyncOptions): UseRealtimeSyncReturn {
  const [objects, setObjects] = useState<BoardObject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  /**
   * Load initial board state from database
   */
  const loadBoardState = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log('Loading board state for:', boardId)

      const { data, error: fetchError } = await supabase
        .from('board_objects')
        .select('*')
        .eq('board_id', boardId)
        .order('z_index', { ascending: true })

      console.log('Query result:', { data, error: fetchError })

      if (fetchError) {
        console.error('Fetch error details:', fetchError)
        throw fetchError
      }

      // Transform database rows to BoardObject type with proper data casting
      const transformedObjects = (data || []).map((row) => ({
        id: row.id,
        board_id: row.board_id,
        type: row.type,
        x: row.x,
        y: row.y,
        width: row.width,
        height: row.height,
        rotation: row.rotation,
        z_index: row.z_index,
        data: row.data as any, // Type assertion - discriminated union handles specifics
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })) as BoardObject[]

      setObjects(transformedObjects)
      console.log('✅ Board state loaded successfully:', transformedObjects.length, 'objects')
    } catch (err) {
      console.error('❌ Error loading board state:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load board'
      console.error('Error details:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [boardId])

  /**
   * Create a new object
   * Pattern B: Broadcast first (instant), then persist to DB (async)
   */
  const createObject = useCallback(
    async (objectData: Omit<BoardObject, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      // Generate temporary ID for optimistic update (outside try block for catch access)
      const tempId = `temp_${Date.now()}_${Math.random()}`
      const now = new Date().toISOString()

      try {
        const newObject: BoardObject = {
          ...objectData,
          id: tempId,
          created_by: null, // Set to null for mock users (will use real userId when auth is implemented)
          created_at: now,
          updated_at: now,
        } as BoardObject

        console.log('Creating object with tempId:', tempId, newObject)

        // 1. Optimistic update - add to local state immediately
        setObjects((prev) => {
          const updated = [...prev, newObject]
          console.log('Optimistic update - objects count:', updated.length)
          return updated
        })

        // 2. Broadcast to other clients (instant visual sync)
        if (channelRef.current) {
          console.log('📡 Broadcasting object_created:', tempId)
          channelRef.current.send({
            type: 'broadcast',
            event: 'object_created',
            payload: newObject,
          })
        } else {
          console.warn('⚠️ Channel not ready, cannot broadcast object creation')
        }

        // 3. Persist to database (async)
        const { data, error: insertError } = await supabase
          .from('board_objects')
          .insert({
            board_id: objectData.board_id,
            type: objectData.type,
            x: objectData.x,
            y: objectData.y,
            width: objectData.width,
            height: objectData.height,
            rotation: objectData.rotation,
            z_index: objectData.z_index,
            data: objectData.data,
            created_by: null, // Set to null for testing (will use real userId with auth)
          })
          .select()
          .single()

        if (insertError) {
          console.error('❌ Database insert error:', insertError)
          console.error('Insert error details:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
          })
          throw insertError
        }

        // 4. Replace temp ID with real DB ID
        setObjects((prev) => {
          const updated = prev.map((obj) =>
            obj.id === tempId
              ? ({
                  ...data,
                  data: data.data as any,
                } as BoardObject)
              : obj
          )
          console.log('Replaced tempId with real ID:', tempId, '→', data?.id)
          console.log('Final objects array:', updated.length, 'objects')
          return updated
        })

        // 5. Broadcast ID replacement to other clients
        if (channelRef.current && data) {
          console.log('📡 Broadcasting id_replaced:', tempId, '→', data.id)
          channelRef.current.send({
            type: 'broadcast',
            event: 'id_replaced',
            payload: {
              tempId,
              realId: data.id,
              realObject: {
                ...data,
                data: data.data as any,
              } as BoardObject,
            },
          })
        }

        console.log('✅ Object created successfully:', data?.id)
      } catch (err) {
        console.error('❌ Error creating object:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to create object'
        console.error('Create error details:', errorMessage)
        setError(errorMessage)

        // Rollback optimistic update on error
        setObjects((prev) => prev.filter((obj) => obj.id !== tempId))
      }
    },
    [boardId, userId]
  )

  /**
   * Update an existing object
   * Pattern B: Broadcast first, then persist
   */
  const updateObject = useCallback(
    async (id: string, updates: Partial<BoardObject>) => {
      try {
        console.log('Updating object:', id, updates)

        // Check if this is a temp ID (not yet saved to database)
        const isTempId = id.startsWith('temp_')

        // Store the previous state for rollback
        let previousObject: BoardObject | undefined

        // 1. Optimistic update
        setObjects((prev) => {
          const objIndex = prev.findIndex((obj) => obj.id === id)
          if (objIndex === -1) {
            console.warn('Object not found for update:', id)
            return prev
          }

          previousObject = prev[objIndex]

          return prev.map((obj) =>
            obj.id === id
              ? ({ ...obj, ...updates, updated_at: new Date().toISOString() } as BoardObject)
              : obj
          )
        })

        // 2. Broadcast to other clients (always broadcast, even for temp IDs)
        if (channelRef.current) {
          console.log('📡 Broadcasting object_updated:', id, updates)
          channelRef.current.send({
            type: 'broadcast',
            event: 'object_updated',
            payload: { id, updates },
          })
        }

        // 3. Skip database update for temp IDs (not yet persisted)
        if (isTempId) {
          console.log('Skipping DB update for temp ID:', id)
          return
        }

        // 4. Persist to database (only send fields that exist in DB schema)
        const dbUpdates: any = {}
        if (updates.x !== undefined) dbUpdates.x = updates.x
        if (updates.y !== undefined) dbUpdates.y = updates.y
        if (updates.width !== undefined) dbUpdates.width = updates.width
        if (updates.height !== undefined) dbUpdates.height = updates.height
        if (updates.rotation !== undefined) dbUpdates.rotation = updates.rotation
        if (updates.z_index !== undefined) dbUpdates.z_index = updates.z_index
        if (updates.data !== undefined) dbUpdates.data = updates.data

        dbUpdates.updated_at = new Date().toISOString()

        const { error: updateError } = await supabase
          .from('board_objects')
          .update(dbUpdates)
          .eq('id', id)

        if (updateError) {
          console.error('Database update error:', updateError)
          // Rollback optimistic update
          if (previousObject) {
            setObjects((prev) =>
              prev.map((obj) => (obj.id === id ? previousObject! : obj))
            )
          }
          throw updateError
        }

        console.log('✅ Object updated successfully:', id)
      } catch (err) {
        console.error('❌ Error updating object:', err)
        setError(err instanceof Error ? err.message : 'Failed to update object')
        // Error is visible to user now
      }
    },
    []
  )

  /**
   * Delete an object
   * Pattern B: Broadcast first, then persist
   */
  const deleteObject = useCallback(async (id: string) => {
    try {
      // 1. Optimistic update
      setObjects((prev) => prev.filter((obj) => obj.id !== id))

      // 2. Broadcast to other clients
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'object_deleted',
          payload: { id },
        })
      }

      // 3. Persist to database
      const { error: deleteError } = await supabase
        .from('board_objects')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
    } catch (err) {
      console.error('Error deleting object:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete object')
    }
  }, [])

  /**
   * Set up Broadcast channel for real-time object sync
   */
  useEffect(() => {
    const channel = supabase.channel(`board:${boardId}:objects`, {
      config: {
        broadcast: {
          self: false, // Don't receive our own broadcasts
        },
      },
    })

    // Listen for object creation broadcasts
    channel.on('broadcast', { event: 'object_created' }, ({ payload }) => {
      console.log('📥 Received object_created broadcast:', payload)
      const newObject = payload as BoardObject
      setObjects((prev) => {
        // Avoid duplicates (in case object came from DB subscription too)
        if (prev.some((obj) => obj.id === newObject.id)) {
          console.log('⚠️ Duplicate object, skipping:', newObject.id)
          return prev
        }
        console.log('✅ Adding new object from broadcast:', newObject.id)
        return [...prev, newObject]
      })
    })

    // Listen for object update broadcasts
    channel.on('broadcast', { event: 'object_updated' }, ({ payload }) => {
      const { id, updates } = payload as { id: string; updates: Partial<BoardObject> }
      console.log('📥 Received object_updated broadcast:', id, updates)
      setObjects((prev) =>
        prev.map((obj) =>
          obj.id === id
            ? ({ ...obj, ...updates, updated_at: new Date().toISOString() } as BoardObject)
            : obj
        )
      )
    })

    // Listen for object deletion broadcasts
    channel.on('broadcast', { event: 'object_deleted' }, ({ payload }) => {
      const { id } = payload as { id: string }
      setObjects((prev) => prev.filter((obj) => obj.id !== id))
    })

    // Listen for ID replacement broadcasts (temp ID → real DB ID)
    channel.on('broadcast', { event: 'id_replaced' }, ({ payload }) => {
      const { tempId, realId, realObject } = payload as {
        tempId: string
        realId: string
        realObject: BoardObject
      }
      console.log('📥 Received id_replaced broadcast:', tempId, '→', realId)
      setObjects((prev) => {
        const updated = prev.map((obj) =>
          obj.id === tempId ? realObject : obj
        )
        console.log('✅ Replaced temp ID with real ID in local state')
        return updated
      })
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Object sync channel connected')
      }
    })

    channelRef.current = channel

    // Load initial state
    loadBoardState()

    return () => {
      console.log('🧹 Cleaning up object sync channel')
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [boardId, loadBoardState])

  return {
    objects,
    createObject,
    updateObject,
    deleteObject,
    isLoading,
    error,
  }
}
