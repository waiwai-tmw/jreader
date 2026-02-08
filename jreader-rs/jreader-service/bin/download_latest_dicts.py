#!/usr/bin/env python3

import requests
import os
from tqdm import tqdm

def get_latest_release(repo):
    """
    Fetches the latest release information for a given GitHub repository.
    """
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Failed to fetch latest release: {response.status_code}")

def download_file(url, filename):
    """
    Downloads a file from a given URL and saves it to a specific directory.
    Shows a progress bar during download.
    """
    # Get the absolute path of the script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Create path for data directory relative to the script location
    target_dir = os.path.join(script_dir, "..", "..", "data", "dicts", "yomitan")
    os.makedirs(target_dir, exist_ok=True)
    
    # Get the absolute path for better logging
    filepath = os.path.abspath(os.path.join(target_dir, filename))
    
    if os.path.exists(filepath):
        print(f"File already exists, skipping: {filepath}")
        return

    print(f"Downloading from: {url}, saving file to: {filepath}")
    
    response = requests.get(url, stream=True)
    if response.status_code == 200:
        total_size = int(response.headers.get('content-length', 0))
        
        with open(filepath, "wb") as f:
            with tqdm(
                total=total_size,
                unit='iB',
                unit_scale=True,
                unit_divisor=1024,
                desc=filename
            ) as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    size = f.write(chunk)
                    pbar.update(size)
        print(f"Downloaded: {filepath}")
    else:
        raise Exception(f"Failed to download file: {response.status_code}")

def find_multiple_assets(release_data, keywords):
    """
    Finds multiple assets in the release matching specific keywords.
    Returns a list of (name, url) tuples for matching assets.
    """
    assets = []
    for keyword in keywords:
        for asset in release_data.get("assets", []):
            if keyword in asset["name"]:
                assets.append((asset["name"], asset["browser_download_url"]))
    return assets

def main():
    # Dictionary of repos and their configurations
    repos = {
        "MarvNC/wikipedia-yomitan": {
            "files": ["ja.Wikipedia"],
            "add_tag": False
        },
        "MarvNC/jmdict-yomitan": {
            "files": [
                "JMdict_english.zip",
                "JMdict_english_with_examples.zip",
                "JMnedict.zip",
                "KANJIDIC_english.zip"
            ],
            "add_tag": True
        },
        "stephenmk/stephenmk.github.io": {
            "files": ["jitendex-yomitan.zip"],
            "add_tag": True
        },
        "MarvNC/pixiv-yomitan": {
            "files": ["PixivLight_", "Pixiv_"],
            "add_tag": False
        }
    }
    
    for repo, config in repos.items():
        try:
            print(f"\nProcessing repository: {repo}")
            release_data = get_latest_release(repo)
            latest_tag = release_data["tag_name"]
            print(f"Latest release: {latest_tag}")
            
            assets = find_multiple_assets(release_data, config["files"])
            
            if not assets:
                print(f"No matching assets found in {repo}")
                continue
                
            for filename, download_url in assets:
                if download_url:
                    print(f"Found asset: {filename}")
                    # Add tag to filename if specified in config
                    if config["add_tag"]:
                        base, ext = os.path.splitext(filename)
                        tagged_filename = f"{base}_{latest_tag}{ext}"
                    else:
                        tagged_filename = filename
                    download_file(download_url, tagged_filename)
                else:
                    print(f"No asset found: {filename}")
                    
        except Exception as e:
            print(f"Error processing {repo}: {e}")
            continue

if __name__ == "__main__":
    main()