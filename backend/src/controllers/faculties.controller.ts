import { Request, Response } from 'express';
import { pgPool } from '../config/database';

export const facultiesController = {
  // Get all faculties with stats
  getFaculties: async (req: Request, res: Response) => {
    try {
      const result = await pgPool.query(`
        SELECT 
          faculty,
          COUNT(DISTINCT u.id) as member_count,
          COUNT(DISTINCT p.id) as post_count,
          COUNT(DISTINCT e.id) as event_count
        FROM users u
        LEFT JOIN posts p ON p.user_id = u.id AND p.deleted_at IS NULL
        LEFT JOIN events e ON e.organizer_id = u.id AND e.deleted_at IS NULL
        WHERE u.faculty IS NOT NULL 
          AND u.faculty != ''
          AND u.deleted_at IS NULL
        GROUP BY faculty
        ORDER BY member_count DESC, faculty ASC
      `);

      const faculties = result.rows.map(row => ({
        id: row.faculty.toLowerCase().replace(/\s+/g, '-'),
        name: row.faculty,
        memberCount: parseInt(row.member_count) || 0,
        postCount: parseInt(row.post_count) || 0,
        eventCount: parseInt(row.event_count) || 0
      }));

      res.json({
        success: true,
        faculties
      });
    } catch (error: any) {
      console.error('Get Faculties Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch faculties'
      });
    }
  },

  // Get faculty stats
  getFacultyStats: async (req: Request, res: Response) => {
    try {
      const { facultyId } = req.params;
      const facultyName = facultyId.replace(/-/g, ' ');

      const statsResult = await pgPool.query(`
        SELECT 
          COUNT(DISTINCT u.id) as member_count,
          COUNT(DISTINCT p.id) as post_count,
          COUNT(DISTINCT e.id) as event_count
        FROM users u
        LEFT JOIN posts p ON p.user_id = u.id AND p.deleted_at IS NULL
        LEFT JOIN events e ON e.organizer_id = u.id AND e.deleted_at IS NULL
        WHERE u.faculty = $1 
          AND u.deleted_at IS NULL
      `, [facultyName]);

      if (statsResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Faculty not found'
        });
      }

      const stats = statsResult.rows[0];
      res.json({
        success: true,
        stats: {
          memberCount: parseInt(stats.member_count) || 0,
          postCount: parseInt(stats.post_count) || 0,
          eventCount: parseInt(stats.event_count) || 0
        }
      });
    } catch (error: any) {
      console.error('Get Faculty Stats Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch faculty stats'
      });
    }
  }
};

