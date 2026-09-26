import { useState, useEffect } from "react";
import App from "./App.jsx";
import ProjectSelect from "./ProjectSelect.jsx";

const STORAGE_KEY = "bariled_projects";

export default function AppRoot() {
    const [projects, setProjects] = useState([])
    const [activeProjectId, setActiveProjectId] = useState(null)

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {

        setProjects(JSON.parse(saved))
        }
    }, [])
    const saveProjects = (next)=> {
        setProjects(next)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }

     const createProject = () => {
        const id = Date.now().toString()
        const newProject = {id, name: "Untitled Map", lastEdited: Date.now()}
        saveProjects([newProject, ...projects])
        setActiveProjectId(id)
    }
    const deleteProject =(id)=> {
        saveProjects(projects.filter((p)=> p.id !== id))
    }
    const openProject = (id)=> {
        setActiveProjectId(id)
    }
    const goBackToProjects = ()=> {
        setActiveProjectId(null)
    }

    if (activeProjectId) {
        return <App onBack={goBackToProjects} />
    }

    return(
        <ProjectSelect
            projects={projects}
            onCreate={createProject}
            onOpen={openProject}
            onDelete={deleteProject}/>
    )
}